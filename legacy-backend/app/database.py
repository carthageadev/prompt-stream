"""
Database connection and initialization helpers.
"""

import os

from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .models import (
    Base,
    PromptBlockModel,
    StackModel,
    TagColorModel,
)

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/stream_prompts",
)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    """Dependency for getting async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_database():
    """Initialize database tables and backfill newer columns."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        statements = [
            "ALTER TABLE tag_colors ADD COLUMN IF NOT EXISTS lightness INTEGER NOT NULL DEFAULT 32",
            "UPDATE tag_colors SET lightness = 32 WHERE lightness IS NULL",
            "ALTER TABLE stacks ADD COLUMN IF NOT EXISTS slug VARCHAR",
            "ALTER TABLE stacks ADD COLUMN IF NOT EXISTS description TEXT",
            "ALTER TABLE stacks ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE stacks ADD COLUMN IF NOT EXISTS theme_key VARCHAR NOT NULL DEFAULT 'midnight-grid'",
            "ALTER TABLE stacks ADD COLUMN IF NOT EXISTS cover_image VARCHAR",
            "ALTER TABLE stacks ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ",
            (
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_stacks_slug_unique "
                "ON stacks (slug) WHERE slug IS NOT NULL"
            ),
            "ALTER TABLE prompt_blocks ADD COLUMN IF NOT EXISTS parent_prompt_id VARCHAR",
            "ALTER TABLE prompt_blocks ADD COLUMN IF NOT EXISTS root_prompt_id VARCHAR",
            "ALTER TABLE prompt_blocks ADD COLUMN IF NOT EXISTS fork_note TEXT",
            "ALTER TABLE prompt_blocks ADD COLUMN IF NOT EXISTS derived_from_stack_id VARCHAR",
            "UPDATE prompt_blocks SET root_prompt_id = id WHERE root_prompt_id IS NULL",
        ]

        for statement in statements:
            await conn.execute(text(statement))


async def seed_database():
    """Seed the database with initial data if empty."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(text("SELECT count(*) FROM prompt_blocks"))
        count = result.scalar()

        if count and count > 0:
            return False

        initial_blocks = [
            PromptBlockModel(
                id="seed-1",
                type="persona",
                title="Senior React Architect",
                content=(
                    "Act as a Senior Software Architect specializing in React, "
                    "TypeScript, and Scalable Front-end Systems. You prioritize "
                    "clean architecture, performance optimization, and maintainability."
                ),
                tags=["Role", "React", "TypeScript"],
                stack_id=None,
                stack_order=None,
                root_prompt_id="seed-1",
            ),
            PromptBlockModel(
                id="seed-2",
                type="context",
                title="Modern Stack Context",
                content=(
                    "The project uses Next.js 14 (App Router), Tailwind CSS for styling, "
                    "and Zustand for state management. Strictly adhere to modern React "
                    "patterns (Server Components where applicable)."
                ),
                tags=["Context", "React", "Next.js"],
                stack_id=None,
                stack_order=None,
                root_prompt_id="seed-2",
            ),
            PromptBlockModel(
                id="seed-3",
                type="format",
                title="Markdown Output",
                content=(
                    'Provide the response in clean Markdown. Use standard code blocks '
                    'for all examples. Briefly explain the "Why" before showing the "How".'
                ),
                tags=["Output"],
                stack_id=None,
                stack_order=None,
                root_prompt_id="seed-3",
            ),
            PromptBlockModel(
                id="seed-4",
                type="instruction",
                title="Code Review Guidelines",
                content=(
                    "Review code with these priorities:\n1. Security vulnerabilities\n"
                    "2. Performance implications\n3. Code readability and maintainability\n"
                    "4. Edge cases and error handling\n5. Test coverage suggestions"
                ),
                tags=["Logic", "Code"],
                stack_id=None,
                stack_order=None,
                root_prompt_id="seed-4",
            ),
            PromptBlockModel(
                id="seed-5",
                type="constraint",
                title="Clean Code Rules",
                content=(
                    "- Keep functions under 20 lines\n- No magic numbers - use named constants\n"
                    "- Single responsibility per function\n- Descriptive variable names\n"
                    "- Avoid nested callbacks - use async/await"
                ),
                tags=["Rules", "Code"],
                stack_id=None,
                stack_order=None,
                root_prompt_id="seed-5",
            ),
            PromptBlockModel(
                id="seed-6",
                type="persona",
                title="Python Data Scientist",
                content=(
                    "You are an experienced Data Scientist with expertise in Python, "
                    "Pandas, NumPy, and machine learning frameworks like TensorFlow and "
                    "PyTorch. Focus on efficient data processing and clear visualizations."
                ),
                tags=["Role", "Python"],
                stack_id=None,
                stack_order=None,
                root_prompt_id="seed-6",
            ),
        ]

        session.add_all(initial_blocks)
        await session.commit()
        return True
