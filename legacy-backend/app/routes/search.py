"""
Semantic search routes.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import PromptBlockModel, SemanticSearchRequest, SemanticSearchResponse, SemanticSearchResult
from ..services.insights import fallback_profile, get_insight_row, semantic_similarity
from ..services.openrouter import extract_keywords

router = APIRouter(prefix="/search", tags=["search"])


@router.post("/semantic", response_model=SemanticSearchResponse)
async def semantic_search(
    payload: SemanticSearchRequest, db: AsyncSession = Depends(get_db)
):
    query = payload.query.strip()
    query_terms = set(extract_keywords(query, limit=12))
    if not query_terms and query:
        query_terms = {part.lower() for part in query.split() if part.strip()}

    result = await db.execute(select(PromptBlockModel))
    prompts = result.scalars().all()

    filtered = []
    for prompt in prompts:
        if payload.stack_id and prompt.stack_id != payload.stack_id:
            continue
        if payload.active_tags and not any(tag in payload.active_tags for tag in (prompt.tags or [])):
            continue
        filtered.append(prompt)

    ranked = []
    for prompt in filtered:
        haystack = " ".join(
            [prompt.title.lower(), prompt.content.lower(), " ".join((prompt.tags or []))]
        )
        lexical_hits = sum(1 for term in query_terms if term in haystack)
        lexical_score = min(1.0, lexical_hits * 0.2)

        row = await get_insight_row(db, prompt.id)
        profile = row.semantic_profile if row and row.semantic_profile else fallback_profile(prompt)
        query_profile = {
            "intent": query,
            "output_style": "search",
            "keywords": list(query_terms),
            "constraints": [],
            "personas": [],
        }
        semantic_score, reason = semantic_similarity(query_profile, profile, query_terms)
        total = lexical_score + semantic_score
        if total <= 0:
            continue
        ranked.append((total, reason, prompt.id))

    ranked.sort(key=lambda item: item[0], reverse=True)
    results = [
        SemanticSearchResult(prompt_id=prompt_id, score=round(score, 3), reason=reason)
        for score, reason, prompt_id in ranked[: payload.limit]
    ]

    return SemanticSearchResponse(query=query, results=results)
