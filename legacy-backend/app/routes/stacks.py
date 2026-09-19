"""
API routes for stacks.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import (
    PromptBlockModel,
    Stack,
    StackCreate,
    StackModel,
    StackPublishRequest,
    StackUpdate,
)

router = APIRouter(prefix="/stacks", tags=["stacks"])


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:80] or "stack"


async def _ensure_unique_slug(
    db: AsyncSession, slug: str, exclude_stack_id: str | None = None
) -> None:
    query = select(StackModel).where(StackModel.slug == slug)
    result = await db.execute(query)
    existing = result.scalar_one_or_none()
    if existing and existing.id != exclude_stack_id:
        raise HTTPException(status_code=409, detail="Slug already exists")


@router.get("", response_model=list[Stack])
async def get_all_stacks(db: AsyncSession = Depends(get_db)):
    query = select(StackModel).order_by(StackModel.created_at.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{stack_id}", response_model=Stack)
async def get_stack(stack_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StackModel).where(StackModel.id == stack_id))
    stack = result.scalar_one_or_none()
    if not stack:
        raise HTTPException(status_code=404, detail="Stack not found")
    return stack


@router.post("", response_model=Stack, status_code=status.HTTP_201_CREATED)
async def create_stack(stack: StackCreate, db: AsyncSession = Depends(get_db)):
    slug = slugify(stack.slug or stack.name)
    await _ensure_unique_slug(db, slug)

    new_stack = StackModel(
        id=stack.id,
        name=stack.name,
        slug=slug,
        description=stack.description,
        is_published=stack.is_published,
        theme_key=stack.theme_key,
        cover_image=stack.cover_image,
        published_at=stack.published_at,
    )
    db.add(new_stack)
    await db.commit()
    await db.refresh(new_stack)
    return new_stack


@router.patch("/{stack_id}", response_model=Stack)
async def update_stack(
    stack_id: str, updates: StackUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(StackModel).where(StackModel.id == stack_id))
    stack = result.scalar_one_or_none()

    if not stack:
        raise HTTPException(status_code=404, detail="Stack not found")

    update_data = updates.model_dump(exclude_unset=True)
    if not update_data:
        return stack

    if "slug" in update_data and update_data["slug"]:
        update_data["slug"] = slugify(update_data["slug"])
        await _ensure_unique_slug(db, update_data["slug"], stack_id)

    if "name" in update_data and not update_data.get("slug"):
        candidate_slug = slugify(update_data["name"])
        if stack.slug != candidate_slug:
            await _ensure_unique_slug(db, candidate_slug, stack_id)
            update_data["slug"] = candidate_slug

    for key, value in update_data.items():
        setattr(stack, key, value)

    await db.commit()
    await db.refresh(stack)
    return stack


@router.patch("/{stack_id}/publish", response_model=Stack)
async def publish_stack(
    stack_id: str, payload: StackPublishRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(StackModel).where(StackModel.id == stack_id))
    stack = result.scalar_one_or_none()

    if not stack:
        raise HTTPException(status_code=404, detail="Stack not found")

    stack.is_published = payload.is_published
    if payload.is_published:
        stack.slug = slugify(payload.slug or stack.slug or stack.name)
        await _ensure_unique_slug(db, stack.slug, stack_id)
        stack.published_at = datetime.now(timezone.utc)
    else:
        stack.published_at = None

    await db.commit()
    await db.refresh(stack)
    return stack


@router.delete("/{stack_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stack(stack_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(
        update(PromptBlockModel)
        .where(PromptBlockModel.stack_id == stack_id)
        .values(stack_id=None, stack_order=None)
    )

    await db.execute(delete(StackModel).where(StackModel.id == stack_id))
    await db.commit()
    return None
