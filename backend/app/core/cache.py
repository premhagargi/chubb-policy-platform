"""In-memory cache.

The Python counterpart of the `IMemoryCache` + `PolicyCacheInvalidator` pair from
the .NET implementation:

* per-entry TTL, checked lazily on read;
* a monotonically increasing *generation* stamped onto every entry, so a single
  `invalidate_all()` after a mutation logically evicts everything registered
  against the previous generation;
* bounded size with FIFO eviction, so an unbounded stream of distinct filter
  combinations cannot grow the process heap indefinitely;
* hit/miss counters, surfaced by GET /api/v1/cache/stats so the caching layer is
  observable rather than merely asserted.

Deliberately process-local: this is a POC, and a single-node in-memory cache was
an explicit requirement. Redis (or any shared cache) is the correct swap for a
multi-replica deployment - see docs/ARCHITECTURE.md.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, TypeVar

T = TypeVar("T")


@dataclass(slots=True)
class _Entry:
    value: Any
    expires_at: float
    generation: int


@dataclass(frozen=True, slots=True)
class CacheStats:
    hits: int
    misses: int
    entries: int
    generation: int
    evictions: int

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return round(self.hits / total, 4) if total else 0.0


class InMemoryCache:
    """Thread-safe TTL cache. Sync by design - every operation is O(1) dictionary
    work with no I/O, so a plain lock costs less than an async one would."""

    def __init__(self, max_entries: int = 512) -> None:
        self._entries: dict[str, _Entry] = {}
        self._lock = threading.Lock()
        self._generation = 0
        self._hits = 0
        self._misses = 0
        self._evictions = 0
        self._max_entries = max_entries

    def get(self, key: str) -> Any | None:
        now = time.monotonic()
        with self._lock:
            entry = self._entries.get(key)

            if entry is None:
                self._misses += 1
                return None

            # Stale generation => a mutation happened after this entry was written.
            if entry.generation != self._generation or entry.expires_at <= now:
                del self._entries[key]
                self._misses += 1
                return None

            self._hits += 1
            return entry.value

    def set(self, key: str, value: Any, ttl_seconds: float) -> None:
        with self._lock:
            if key not in self._entries and len(self._entries) >= self._max_entries:
                # FIFO: dicts preserve insertion order, so the first key is the oldest.
                oldest = next(iter(self._entries))
                del self._entries[oldest]
                self._evictions += 1

            self._entries[key] = _Entry(
                value=value,
                expires_at=time.monotonic() + ttl_seconds,
                generation=self._generation,
            )

    async def aget_or_set(
        self,
        key: str,
        factory: Callable[[], Awaitable[T]],
        ttl_seconds: float,
    ) -> tuple[T, bool]:
        """Returns (value, was_cache_hit).

        No stampede lock around `factory`: concurrent misses on the same key may
        each run it once, which for a read-only query is wasted work rather than
        incorrect work. Single-flight coordination is the right addition under
        real load and is noted as a trade-off in docs/ARCHITECTURE.md.
        """
        cached = self.get(key)
        if cached is not None:
            return cached, True

        value = await factory()
        self.set(key, value, ttl_seconds)
        return value, False

    def invalidate_all(self) -> None:
        """Bump the generation so every existing entry is logically evicted."""
        with self._lock:
            self._generation += 1
            self._entries.clear()

    def stats(self) -> CacheStats:
        with self._lock:
            return CacheStats(
                hits=self._hits,
                misses=self._misses,
                entries=len(self._entries),
                generation=self._generation,
                evictions=self._evictions,
            )

    def reset(self) -> None:
        """Clear entries and counters. Used by tests."""
        with self._lock:
            self._entries.clear()
            self._generation = 0
            self._hits = self._misses = self._evictions = 0
