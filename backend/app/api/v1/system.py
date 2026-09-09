"""Operational endpoints: health and cache observability."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_cache, get_session
from app.application.dto import CacheStatsDto
from app.core.cache import InMemoryCache

router = APIRouter(tags=["System"])


@router.get("/cache/stats", response_model=CacheStatsDto, summary="In-memory cache statistics")
async def cache_stats(cache: Annotated[InMemoryCache, Depends(get_cache)]) -> CacheStatsDto:
    """Makes the caching layer observable rather than merely asserted - issue the
    same request twice and `hits` increments."""
    stats = cache.stats()
    return CacheStatsDto(
        hits=stats.hits,
        misses=stats.misses,
        hit_rate=stats.hit_rate,
        entries=stats.entries,
        generation=stats.generation,
        evictions=stats.evictions,
    )


@router.post("/cache/clear", response_model=CacheStatsDto, summary="Evict every cache entry")
async def clear_cache(cache: Annotated[InMemoryCache, Depends(get_cache)]) -> CacheStatsDto:
    """Exposed so a demo can show a cold-vs-warm comparison on demand."""
    cache.invalidate_all()
    stats = cache.stats()
    return CacheStatsDto(
        hits=stats.hits,
        misses=stats.misses,
        hit_rate=stats.hit_rate,
        entries=stats.entries,
        generation=stats.generation,
        evictions=stats.evictions,
    )


@router.get("/health", summary="Liveness and database readiness")
async def health(session: Annotated[AsyncSession, Depends(get_session)]) -> dict[str, str]:
    await session.execute(text("SELECT 1"))
    return {"status": "healthy", "database": "reachable"}
