"""
Stream Prompts API - Main FastAPI Application
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .database import init_database, seed_database
from .routes import router as blocks_router
from .routes.compositions import router as compositions_router
from .routes.insights import router as insights_router
from .routes.optimize import router as optimize_router
from .routes.prompts import router as prompts_router
from .routes.public import router as public_router
from .routes.search import router as search_router
from .routes.stacks import router as stacks_router
from .routes.tag_colors import router as tag_colors_router
from .models import HealthResponse

load_dotenv()

# Rate Limiter Setup
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    await init_database()
    await seed_database()
    yield


app = FastAPI(
    title="Stream Prompts API",
    description="Backend API for Stream Prompts - a professional prompt engineering studio",
    version="1.0.0",
    lifespan=lifespan,
)

# State for Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS configuration
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(blocks_router, prefix="/api")
app.include_router(prompts_router, prefix="/api")
app.include_router(stacks_router, prefix="/api")
app.include_router(tag_colors_router, prefix="/api")
app.include_router(public_router, prefix="/api")
app.include_router(compositions_router, prefix="/api")
app.include_router(insights_router, prefix="/api")
app.include_router(optimize_router, prefix="/api")
app.include_router(search_router, prefix="/api")


@app.get("/", response_model=HealthResponse)
def health_check():
    """Health check endpoint."""
    return HealthResponse(status="ok", database="connected")


@app.get("/api/health", response_model=HealthResponse)
def api_health():
    """API health check."""
    return HealthResponse(status="ok", database="connected")
