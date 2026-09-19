"""
Prompt lineage and fork routes.
"""

from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import (
    ForkPromptRequest,
    LineageResponse,
    PromptBlock,
    PromptBlockModel,
)

router = APIRouter(prefix="/prompts", tags=["prompts"])


@router.get("/{prompt_id}/lineage", response_model=LineageResponse)
async def get_prompt_lineage(prompt_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PromptBlockModel))
    blocks = result.scalars().all()
    block_map = {block.id: block for block in blocks}
    prompt = block_map.get(prompt_id)

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    ancestors = []
    cursor = prompt
    while cursor.parent_prompt_id and cursor.parent_prompt_id in block_map:
        parent = block_map[cursor.parent_prompt_id]
        ancestors.insert(0, parent)
        cursor = parent

    descendants = []
    frontier = [prompt.id]
    while frontier:
        current_id = frontier.pop(0)
        children = [block for block in blocks if block.parent_prompt_id == current_id]
        descendants.extend(children)
        frontier.extend(child.id for child in children)

    return LineageResponse(
        prompt=PromptBlock.model_validate(prompt),
        ancestors=[PromptBlock.model_validate(item) for item in ancestors],
        descendants=[PromptBlock.model_validate(item) for item in descendants],
    )


@router.post("/{prompt_id}/fork", response_model=PromptBlock, status_code=status.HTTP_201_CREATED)
async def fork_prompt(
    prompt_id: str, payload: ForkPromptRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(PromptBlockModel).where(PromptBlockModel.id == prompt_id))
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=404, detail="Prompt not found")

    fork_id = str(uuid4())
    fork = PromptBlockModel(
        id=fork_id,
        type=source.type,
        title=payload.title or f"{source.title} (Fork)",
        content=source.content,
        tags=list(source.tags or []),
        stack_id=payload.stack_id if payload.stack_id is not None else source.stack_id,
        stack_order=None,
        parent_prompt_id=source.id,
        root_prompt_id=source.root_prompt_id or source.id,
        fork_note=payload.fork_note,
        derived_from_stack_id=source.stack_id,
    )
    db.add(fork)
    await db.commit()
    await db.refresh(fork)
    return fork
