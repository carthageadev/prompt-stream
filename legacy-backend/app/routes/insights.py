"""
AI-assisted prompt insight routes.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import (
    PromptBlock,
    PromptBlockModel,
    QualityScorecard,
    RelatedPromptResult,
    RelatedPromptsResponse,
    SemanticProfile,
    TagMergeSuggestion,
    TagSuggestionResponse,
)
from ..services.insights import ensure_insight, fallback_profile, semantic_similarity

router = APIRouter(prefix="/insights", tags=["insights"])


async def _get_prompt(prompt_id: str, db: AsyncSession) -> PromptBlockModel:
    result = await db.execute(select(PromptBlockModel).where(PromptBlockModel.id == prompt_id))
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return prompt


@router.post("/prompts/{prompt_id}/tags", response_model=TagSuggestionResponse)
async def suggest_prompt_tags(prompt_id: str, db: AsyncSession = Depends(get_db)):
    prompt = await _get_prompt(prompt_id, db)
    all_tags_result = await db.execute(select(PromptBlockModel.tags))
    existing_tags = sorted(
        {
            tag
            for tag_list in all_tags_result.scalars().all()
            for tag in (tag_list or [])
            if isinstance(tag, str)
        }
    )
    row, cached = await ensure_insight(
        db, prompt, update_tags=True, existing_tags=existing_tags
    )
    return TagSuggestionResponse(
        prompt_id=prompt.id,
        cached=cached,
        suggested_tags=row.suggested_tags or [],
        merge_suggestions=[
            TagMergeSuggestion(
                source=item.get("source", ""),
                target=item.get("target", ""),
                reason=item.get("reason", "Suggested consolidation."),
            )
            for item in (row.tag_merge_suggestions or [])
        ],
    )


@router.post("/prompts/{prompt_id}/quality", response_model=QualityScorecard)
async def analyze_prompt_quality(prompt_id: str, db: AsyncSession = Depends(get_db)):
    prompt = await _get_prompt(prompt_id, db)
    row, _ = await ensure_insight(db, prompt, update_quality=True)
    return QualityScorecard(**(row.scorecard or {}))


@router.post("/prompts/{prompt_id}/related", response_model=RelatedPromptsResponse)
async def find_related_prompts(prompt_id: str, db: AsyncSession = Depends(get_db)):
    prompt = await _get_prompt(prompt_id, db)
    row, cached = await ensure_insight(db, prompt, update_semantic=True)
    source_profile = row.semantic_profile or fallback_profile(prompt)

    result = await db.execute(select(PromptBlockModel).where(PromptBlockModel.id != prompt.id))
    candidates = result.scalars().all()

    scored = []
    for candidate in candidates:
        candidate_row = await ensure_insight(db, candidate, update_semantic=False)
        candidate_profile = (
            candidate_row[0].semantic_profile
            if candidate_row and candidate_row[0].semantic_profile
            else fallback_profile(candidate)
        )
        score, reason = semantic_similarity(source_profile, candidate_profile)
        if score <= 0:
            continue
        scored.append((score, reason, candidate))

    scored.sort(key=lambda item: item[0], reverse=True)
    top = scored[:6]
    row.related_prompt_ids = [candidate.id for _, _, candidate in top]
    await db.commit()
    await db.refresh(row)

    return RelatedPromptsResponse(
        prompt_id=prompt.id,
        cached=cached,
        semantic_profile=SemanticProfile(**source_profile),
        results=[
            RelatedPromptResult(
                prompt=PromptBlock.model_validate(candidate),
                score=round(score, 3),
                reason=reason,
            )
            for score, reason, candidate in top
        ],
    )
