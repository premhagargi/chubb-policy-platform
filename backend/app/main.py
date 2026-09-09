"""Application entry point.

Run locally with:

    uvicorn app.main:app --reload --port 5080
"""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.exception_handlers import register_exception_handlers
from app.api.v1.router import api_router
from app.core.cache import InMemoryCache
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.infrastructure.db.seed import seed_policies
from app.infrastructure.db.session import Database
from app.infrastructure.llm.factory import build_llm_provider

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)

    logger.info(
        "Starting API.",
        extra={"environment": settings.environment, "database": _redact(settings.database_url)},
    )

    database = Database(settings)
    await database.create_schema()

    # Schema creation + seeding inline at startup keeps the POC a single
    # self-contained process. A real deployment runs migrations as a separate
    # job so N replicas do not race - see docs/ARCHITECTURE.md.
    async with database.session_factory() as session:
        await seed_policies(
            session,
            target_total=settings.seed_policy_count,
            random_seed=settings.seed_random_seed,
        )

    app.state.settings = settings
    app.state.database = database
    app.state.cache = InMemoryCache(max_entries=settings.cache_max_entries)
    app.state.llm_provider = build_llm_provider(settings)

    try:
        yield
    finally:
        await database.dispose()
        logger.info("API stopped.")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description=(
            "Policy register, portfolio analytics and AI-assisted underwriting review "
            "for Chubb's APAC book. All endpoints are versioned under /api/v1."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_logging(request: Request, call_next):  # type: ignore[no-untyped-def]
        """Structured access log with a per-request id, mirroring what
        `UseSerilogRequestLogging` provided in the .NET implementation."""
        request_id = str(uuid.uuid4())
        started = time.perf_counter()

        response = await call_next(request)

        response.headers["X-Request-Id"] = request_id
        logger.info(
            "HTTP request handled.",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": int((time.perf_counter() - started) * 1000),
            },
        )
        return response

    register_exception_handlers(app)
    app.include_router(api_router)

    @app.get("/health", tags=["System"], summary="Process liveness")
    async def health() -> dict[str, str]:
        """Unversioned liveness probe for container orchestration.
        `/api/v1/health` additionally verifies database reachability."""
        return {"status": "healthy"}

    return app


def _redact(database_url: str) -> str:
    """Never log a connection string with credentials in it."""
    if "@" not in database_url:
        return database_url
    scheme, _, rest = database_url.partition("://")
    return f"{scheme}://***@{rest.rpartition('@')[2]}"


app = create_app()
