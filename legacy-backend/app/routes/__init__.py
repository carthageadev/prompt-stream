"""
API routes for prompt blocks
"""

from fastapi import APIRouter, HTTPException, Depends, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from ..database import get_db
from ..models import (
    PromptBlock,
    PromptBlockCreate,
    PromptBlockUpdate,
    PromptBlockModel,
)

router = APIRouter(prefix="/blocks", tags=["blocks"])


@router.get("", response_model=list[PromptBlock])
async def get_all_blocks(
    request: Request, db: AsyncSession = Depends(get_db)
):  # Request for rate limiter if needed later
    """Get all prompt blocks."""
    query = select(PromptBlockModel).order_by(PromptBlockModel.created_at.desc())
    result = await db.execute(query)
    blocks = result.scalars().all()
    return blocks


@router.post("", response_model=PromptBlock, status_code=status.HTTP_201_CREATED)
async def create_block(block: PromptBlockCreate, db: AsyncSession = Depends(get_db)):
    """Create a new prompt block."""
    new_block = PromptBlockModel(
        id=block.id,
        type=block.type.value,
        title=block.title,
        content=block.content,
        tags=block.tags,
        stack_id=block.stack_id,
        stack_order=block.stack_order,
        parent_prompt_id=block.parent_prompt_id,
        root_prompt_id=block.root_prompt_id or block.id,
        fork_note=block.fork_note,
        derived_from_stack_id=block.derived_from_stack_id,
    )
    db.add(new_block)
    await db.commit()
    await db.refresh(new_block)
    return new_block


@router.patch("/{block_id}", response_model=dict)
async def update_block(
    block_id: str, updates: PromptBlockUpdate, db: AsyncSession = Depends(get_db)
):
    """Update an existing prompt block."""
    # Check if block exists
    result = await db.execute(select(PromptBlockModel).where(PromptBlockModel.id == block_id))
    block = result.scalar_one_or_none()

    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    # Update fields
    update_data = updates.model_dump(exclude_unset=True)
    if "type" in update_data:
        update_data["type"] = update_data["type"].value
    
    if not update_data:
         return {"message": "No updates provided"}

    stmt = update(PromptBlockModel).where(PromptBlockModel.id == block_id).values(**update_data)
    await db.execute(stmt)
    await db.commit()

    return {"message": "Block updated successfully"}


@router.delete("/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_block(block_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a prompt block."""
    result = await db.execute(delete(PromptBlockModel).where(PromptBlockModel.id == block_id))
    await db.commit()
    return None
