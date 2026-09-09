"""Request-scoped dependency wiring.

The composition root: the only module that knows which concrete class satisfies
which port. Handlers depend on the protocol, so the caching decorator is added
or removed here without a single endpoint changing - the same seam the .NET
`DependencyInjection.AddInfrastructure` extension provided.

Process-lifetime objects (engine, cache, LLM provider) are created once in the
lifespan handler and read off `app.state`; only the DB session and the services
bound to it are per-request.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, AsyncIterator

from fastapi import Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ai_service import AiService
from app.application.filters import PolicyFilter, parse_policy_filter
from app.application.ports import LlmProvider, PolicyCommandService, PolicyQueryService
from app.core.cache import InMemoryCache
from app.core.config import Settings, get_settings
from app.infrastructure.caching.cached_policy_service import (
    CacheInvalidatingPolicyCommandService,
    CachedPolicyQueryService,
)
from app.infrastructure.db.session import Database
from app.infrastructure.repositories.policy_repository import (
    SqlPolicyCommandService,
    SqlPolicyQueryService,
)


# ----- process-lifetime singletons ---------------------------------------- #


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_cache(request: Request) -> InMemoryCache:
    return request.app.state.cache


def get_llm_provider(request: Request) -> LlmProvider:
    return request.app.state.llm_provider


def get_database(request: Request) -> Database:
    return request.app.state.database


# ----- per-request -------------------------------------------------------- #


async def get_session(
    database: Annotated[Database, Depends(get_database)],
) -> AsyncIterator[AsyncSession]:
    async with database.session_factory() as session:
        yield session


def get_policy_queries(
    session: Annotated[AsyncSession, Depends(get_session)],
    cache: Annotated[InMemoryCache, Depends(get_cache)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> PolicyQueryService:
    return CachedPolicyQueryService(
        SqlPolicyQueryService(session),
        cache,
        list_ttl_seconds=settings.cache_list_ttl_seconds,
        summary_ttl_seconds=settings.cache_summary_ttl_seconds,
    )


def get_policy_commands(
    session: Annotated[AsyncSession, Depends(get_session)],
    cache: Annotated[InMemoryCache, Depends(get_cache)],
) -> PolicyCommandService:
    return CacheInvalidatingPolicyCommandService(SqlPolicyCommandService(session), cache)


def get_ai_service(
    queries: Annotated[PolicyQueryService, Depends(get_policy_queries)],
    provider: Annotated[LlmProvider, Depends(get_llm_provider)],
    cache: Annotated[InMemoryCache, Depends(get_cache)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> AiService:
    return AiService(
        query_service=queries,
        provider=provider,
        cache=cache,
        cache_ttl_seconds=settings.cache_llm_ttl_seconds,
    )


# ----- query-parameter binding -------------------------------------------- #


def policy_filter_params(
    # Bounds are deliberately *not* declared as Query(ge=..., le=...): FastAPI
    # rejects on the first failing constraint, which would report only one
    # problem per request. `parse_policy_filter` checks every field and raises
    # once with all of them, so a caller fixes a bad request in a single round
    # trip.
    page: Annotated[int, Query(description="1-based page number.")] = 1,
    size: Annotated[int, Query(description="Page size (1-100).")] = 20,
    sort: Annotated[str | None, Query(description='e.g. "premiumAmount,desc".')] = None,
    status: str | None = Query(default=None),
    line_of_business: str | None = Query(default=None, alias="lineOfBusiness"),
    region: str | None = Query(default=None),
    effective_date_from: date | None = Query(default=None, alias="effectiveDateFrom"),
    effective_date_to: date | None = Query(default=None, alias="effectiveDateTo"),
    search: str | None = Query(default=None),
    flagged: bool | None = Query(default=None),
) -> PolicyFilter:
    return parse_policy_filter(
        page=page,
        size=size,
        sort=sort,
        status=status,
        line_of_business=line_of_business,
        region=region,
        effective_date_from=effective_date_from,
        effective_date_to=effective_date_to,
        search=search,
        flagged=flagged,
    )


def summary_filter_params(
    status: str | None = Query(default=None),
    line_of_business: str | None = Query(default=None, alias="lineOfBusiness"),
    region: str | None = Query(default=None),
    effective_date_from: date | None = Query(default=None, alias="effectiveDateFrom"),
    effective_date_to: date | None = Query(default=None, alias="effectiveDateTo"),
    search: str | None = Query(default=None),
    flagged: bool | None = Query(default=None),
) -> PolicyFilter:
    """Same filters as the list endpoint, without paging or sort."""
    return parse_policy_filter(
        status=status,
        line_of_business=line_of_business,
        region=region,
        effective_date_from=effective_date_from,
        effective_date_to=effective_date_to,
        search=search,
        flagged=flagged,
    )
