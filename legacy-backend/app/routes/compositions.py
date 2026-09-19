"""
Composition routes.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import (
    Composition,
    CompositionCreate,
    CompositionItem,
    CompositionItemModel,
    CompositionModel,
    PromptBlock,
    PromptBlockModel,
    CompositionUpdate,
)

router = APIRouter(prefix="/compositions", tags=["compositions"])


async def _serialize_composition(
    db: AsyncSession, composition: CompositionModel
) -> Composition:
    source_ids = [item.source_prompt_id for item in composition.items if item.source_prompt_id]
    prompts_by_id: dict[str, PromptBlock] = {}
    if source_ids:
        result = await db.execute(
            select(PromptBlockModel).where(PromptBlockModel.id.in_(source_ids))
        )
        prompts_by_id = {
            prompt.id: PromptBlock.model_validate(prompt)
            for prompt in result.scalars().all()
        }

    items = []
    for item in composition.items:
        payload = CompositionItem.model_validate(item).model_dump()
        if item.source_prompt_id:
            payload["prompt"] = prompts_by_id.get(item.source_prompt_id)
        items.append(CompositionItem(**payload))

    data = Composition.model_validate(composition).model_dump()
    data["items"] = items
    return Composition(**data)


@router.get("", response_model=list[Composition])
async def get_compositions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CompositionModel)
        .options(selectinload(CompositionModel.items))
        .order_by(CompositionModel.updated_at.desc())
    )
    compositions = result.scalars().unique().all()
    return [await _serialize_composition(db, composition) for composition in compositions]


@router.get("/{composition_id}", response_model=Composition)
async def get_composition(composition_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CompositionModel)
        .where(CompositionModel.id == composition_id)
        .options(selectinload(CompositionModel.items))
    )
    composition = result.scalar_one_or_none()
    if not composition:
        raise HTTPException(status_code=404, detail="Composition not found")
    return await _serialize_composition(db, composition)


@router.post("", response_model=Composition, status_code=status.HTTP_201_CREATED)
async def create_composition(
    payload: CompositionCreate, db: AsyncSession = Depends(get_db)
):
    composition = CompositionModel(
        id=payload.id,
        name=payload.name,
        description=payload.description,
        source_stack_id=payload.source_stack_id,
    )
    db.add(composition)

    for item in payload.items:
        db.add(
            CompositionItemModel(
                id=item.id,
                composition_id=payload.id,
                source_prompt_id=item.source_prompt_id,
                kind=item.kind.value,
                content=item.content,
                section=item.section.value,
                position=item.position,
                label=item.label,
            )
        )

    await db.commit()
    return await get_composition(payload.id, db)


@router.patch("/{composition_id}", response_model=Composition)
async def update_composition(
    composition_id: str, payload: CompositionUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(CompositionModel)
        .where(CompositionModel.id == composition_id)
        .options(selectinload(CompositionModel.items))
    )
    composition = result.scalar_one_or_none()
    if not composition:
        raise HTTPException(status_code=404, detail="Composition not found")

    updates = payload.model_dump(exclude_unset=True)
    items = updates.pop("items", None)

    for key, value in updates.items():
        setattr(composition, key, value)

    if items is not None:
        await db.execute(
            delete(CompositionItemModel).where(
                CompositionItemModel.composition_id == composition_id
            )
        )
        for item in items:
            db.add(
                CompositionItemModel(
                    id=item["id"],
                    composition_id=composition_id,
                    source_prompt_id=item.get("source_prompt_id"),
                    kind=item["kind"].value if hasattr(item["kind"], "value") else item["kind"],
                    content=item.get("content", ""),
                    section=item["section"].value if hasattr(item["section"], "value") else item["section"],
                    position=item.get("position", 0),
                    label=item.get("label"),
                )
            )

    await db.commit()
    return await get_composition(composition_id, db)
