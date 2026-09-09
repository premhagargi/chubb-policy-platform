"""Caching decorator over the policy query port.

Structurally identical to the C# `CachedPolicyQueryService`: same TTLs, same
key composition, same decision not to cache single-entity lookups (already a
primary-key hit, and caching them would make the detail drawer show stale flag
state right after a mutation).

Because it satisfies the same `PolicyQueryService` protocol as the SQL
implementation, the API layer cannot tell the two apart - caching is added by
composition at the DI seam, not by branching inside the query code.
"""

from __future__ import annotations

import logging
import uuid
from typing import Sequence

from app.application.dto import PagedResult, PolicyDto, PolicySummaryDto
from app.application.filters import PolicyFilter
from app.application.ports import PolicyCommandService, PolicyQueryService
from app.core.cache import InMemoryCache

logger = logging.getLogger(__name__)


class CachedPolicyQueryService:
    def __init__(
        self,
        inner: PolicyQueryService,
        cache: InMemoryCache,
        *,
        list_ttl_seconds: float,
        summary_ttl_seconds: float,
    ) -> None:
        self._inner = inner
        self._cache = cache
        self._list_ttl = list_ttl_seconds
        self._summary_ttl = summary_ttl_seconds

    async def get_policies(self, request: PolicyFilter) -> PagedResult[PolicyDto]:
        key = request.cache_key("policies", include_paging=True)
        result, hit = await self._cache.aget_or_set(
            key, lambda: self._inner.get_policies(request), self._list_ttl
        )
        logger.debug("Policy list cache %s", "HIT" if hit else "MISS", extra={"cache_key": key})
        return result

    async def get_by_id(self, policy_id: uuid.UUID) -> PolicyDto | None:
        return await self._inner.get_by_id(policy_id)

    async def get_summary(self, request: PolicyFilter) -> PolicySummaryDto:
        key = request.cache_key("summary", include_paging=False)
        result, hit = await self._cache.aget_or_set(
            key, lambda: self._inner.get_summary(request), self._summary_ttl
        )
        logger.debug("Policy summary cache %s", "HIT" if hit else "MISS", extra={"cache_key": key})
        return result


class CacheInvalidatingPolicyCommandService:
    """Wraps the command port so every successful mutation evicts the read cache.

    Invalidating *everything* rather than surgically expiring affected keys:
    flagging changes summary aggregations and the contents of any list whose
    filter touches flagged state, so computing the precise key set costs more
    than rebuilding a handful of 30-second cache entries.
    """

    def __init__(self, inner: PolicyCommandService, cache: InMemoryCache) -> None:
        self._inner = inner
        self._cache = cache

    async def flag_policies(self, policy_ids: Sequence[uuid.UUID]) -> list[uuid.UUID]:
        flagged = await self._inner.flag_policies(policy_ids)

        if flagged:
            self._cache.invalidate_all()
            logger.info("Policy cache invalidated after flag mutation.", extra={"flagged": len(flagged)})

        return flagged
