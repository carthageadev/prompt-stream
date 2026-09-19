"""
API routes for tag colors
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert
from ..database import get_db
from ..models import TagColor, TagColorCreate, TagColorModel

router = APIRouter(prefix="/tag-colors", tags=["tag-colors"])


@router.get("", response_model=list[TagColor])
async def get_all_tag_colors(db: AsyncSession = Depends(get_db)):
    """Get all tag colors."""
    query = select(TagColorModel)
    result = await db.execute(query)
    colors = result.scalars().all()
    return colors


@router.put("/{tag_name}", response_model=TagColor)
async def set_tag_color(
    tag_name: str, color: TagColorCreate, db: AsyncSession = Depends(get_db)
):
    """Set or update a tag color."""
    # Postgres upsert
    stmt = insert(TagColorModel).values(
        name=tag_name, hue=color.hue, lightness=color.lightness
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["name"],
        set_={"hue": stmt.excluded.hue, "lightness": stmt.excluded.lightness},
    )
    
    await db.execute(stmt)
    await db.commit()

    return TagColor(name=tag_name, hue=color.hue, lightness=color.lightness)


@router.delete("/{tag_name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag_color(tag_name: str, db: AsyncSession = Depends(get_db)):
    """Delete a custom tag color."""
    await db.execute(delete(TagColorModel).where(TagColorModel.name == tag_name))
    await db.commit()
    return None
