"""
Public read-only routes.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import PromptBlock, PromptBlockModel, PublicStackResponse, Stack, StackModel

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/stacks/{slug}", response_model=PublicStackResponse)
async def get_public_stack(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StackModel).where(StackModel.slug == slug))
    stack = result.scalar_one_or_none()

    if not stack or not stack.is_published:
        raise HTTPException(status_code=404, detail="Published stack not found")

    prompts_result = await db.execute(
        select(PromptBlockModel)
        .where(PromptBlockModel.stack_id == stack.id)
        .order_by(PromptBlockModel.stack_order.asc().nulls_last(), PromptBlockModel.created_at.desc())
    )
    prompts = prompts_result.scalars().all()

    return PublicStackResponse(
        stack=Stack.model_validate(stack),
        prompts=[PromptBlock.model_validate(prompt) for prompt in prompts],
    )
