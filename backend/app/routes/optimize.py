"""
Prompt optimization route (backing the Rack / Mixer "Generate Prompt" action).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..models import OptimizeRequest, OptimizeResponse
from ..services.openrouter import optimize_prompt_text

router = APIRouter(prefix="/optimize", tags=["optimize"])


@router.post("", response_model=OptimizeResponse)
async def optimize(payload: OptimizeRequest):
    """Merge stacked prompt fragments into one optimized prompt."""
    fragments = payload.prompt.strip()
    if not fragments:
        raise HTTPException(status_code=400, detail="Prompt is empty")

    text = optimize_prompt_text(fragments)
    if not text:
        raise HTTPException(status_code=502, detail="Optimization failed")
    return OptimizeResponse(text=text)
