# Backend Dockerfile

# Stage 1: Builder
FROM python:3.13-slim AS builder

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies into a virtual environment
# We use --frozen to ensure we use the lockfile exactly
RUN uv sync --frozen --no-install-project

# Stage 2: Runtime
FROM python:3.13-slim

WORKDIR /app

# Copy virtual environment from builder // COPY --from=builder /app/.venv /app/.venv
# Actually, the standard pattern for uv is just to copy the venv.
# But let's copy the whole .venv created by uv.
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY app ./app
COPY .env.example ./

# Set environment variables
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Run the application
# Host 0.0.0.0 is crucial for Docker networking
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
