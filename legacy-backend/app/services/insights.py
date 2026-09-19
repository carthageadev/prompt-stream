"""
Prompt insight persistence and semantic scoring helpers.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import PromptBlockModel, PromptInsightModel
from .openrouter import (
    analyze_quality,
    build_semantic_profile,
    content_hash,
    heuristic_semantic_profile,
    suggest_tags,
)


def _profile_terms(profile: dict[str, Any] | None) -> set[str]:
    if not profile:
        return set()
    terms = set()
    for key in ("keywords", "constraints", "personas"):
        for item in profile.get(key, []):
            if isinstance(item, str):
                terms.update(part.strip().lower() for part in item.split() if part.strip())
    if profile.get("intent"):
        terms.update(part.strip().lower() for part in str(profile["intent"]).split())
    if profile.get("output_style"):
        terms.update(part.strip().lower() for part in str(profile["output_style"]).split())
    return terms


def semantic_similarity(
    source_profile: dict[str, Any], target_profile: dict[str, Any], query_terms: set[str] | None = None
) -> tuple[float, str]:
    source_terms = _profile_terms(source_profile)
    target_terms = _profile_terms(target_profile)
    if not source_terms or not target_terms:
        return 0.0, "low-confidence match"

    overlap = source_terms & target_terms
    union = source_terms | target_terms
    score = len(overlap) / max(1, len(union))

    if query_terms:
        query_overlap = query_terms & target_terms
        score += min(0.45, len(query_overlap) * 0.08)
        if query_overlap:
            return score, "similar intent"

    if source_profile.get("output_style") == target_profile.get("output_style"):
        score += 0.1
        if overlap:
            return score, "same output style"

    if overlap:
        return score, "overlapping constraints"
    return score, "semantic overlap"


async def fetch_prompt_or_404(db: AsyncSession, prompt_id: str) -> PromptBlockModel:
    result = await db.execute(select(PromptBlockModel).where(PromptBlockModel.id == prompt_id))
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise ValueError("Prompt not found")
    return prompt


async def get_insight_row(
    db: AsyncSession, prompt_id: str
) -> PromptInsightModel | None:
    result = await db.execute(
        select(PromptInsightModel).where(PromptInsightModel.prompt_id == prompt_id)
    )
    return result.scalar_one_or_none()


async def ensure_insight(
    db: AsyncSession,
    prompt: PromptBlockModel,
    *,
    update_tags: bool = False,
    existing_tags: list[str] | None = None,
    update_quality: bool = False,
    update_semantic: bool = False,
) -> tuple[PromptInsightModel, bool]:
    row = await get_insight_row(db, prompt.id)
    current_hash = content_hash(prompt.content)
    cached = row is not None and row.content_hash == current_hash

    if row is None:
        row = PromptInsightModel(
            prompt_id=prompt.id,
            content_hash=current_hash,
            suggested_tags=[],
            tag_merge_suggestions=[],
            related_prompt_ids=[],
        )
        db.add(row)
        cached = False

    if row.content_hash != current_hash:
        row.content_hash = current_hash
        row.suggested_tags = []
        row.tag_merge_suggestions = []
        row.scorecard = None
        row.semantic_profile = None
        row.related_prompt_ids = []
        cached = False

    if update_tags and (not cached or not row.suggested_tags):
        tag_result = suggest_tags(
            prompt.title,
            prompt.content,
            existing_tags or [],
            list(prompt.tags or []),
        )
        row.suggested_tags = tag_result.get("suggested_tags", [])
        row.tag_merge_suggestions = tag_result.get("merge_suggestions", [])
        cached = False

    if update_quality and (not cached or not row.scorecard):
        row.scorecard = analyze_quality(prompt.title, prompt.content)
        cached = False

    if update_semantic and (not cached or not row.semantic_profile):
        row.semantic_profile = build_semantic_profile(
            prompt.title, prompt.content, list(prompt.tags or [])
        )
        cached = False

    await db.commit()
    await db.refresh(row)
    return row, cached


def fallback_profile(prompt: PromptBlockModel) -> dict[str, Any]:
    return heuristic_semantic_profile(prompt.title, prompt.content, list(prompt.tags or []))
