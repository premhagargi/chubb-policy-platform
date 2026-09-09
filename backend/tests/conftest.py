"""Test fixtures.

Every test runs against the real application - real router, real dependency
graph, real SQLAlchemy - with two substitutions: an isolated in-memory SQLite
database, and the mock LLM provider so no test makes a network call or needs an
API key.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.cache import InMemoryCache
from app.core.config import Settings
from app.infrastructure.db.seed import seed_policies
from app.infrastructure.db.session import Database
from app.infrastructure.llm.mock_provider import MockLlmProvider
from app.main import create_app

#: Small enough to keep the suite fast, large enough that paging and every
#: (status x line of business x region) combination are still exercised.
TEST_POLICY_COUNT = 140


@pytest.fixture
def settings() -> Settings:
    return Settings(
        database_url="sqlite+aiosqlite:///:memory:",
        seed_policy_count=TEST_POLICY_COUNT,
        llm_provider="mock",
        cors_allowed_origins=["http://localhost:4200"],
        log_level="WARNING",
    )


@pytest_asyncio.fixture
async def client(settings: Settings) -> AsyncClient:
    """App instance with state wired by hand rather than via the lifespan.

    A `:memory:` SQLite database lives only as long as its connection, so the
    schema and the seed have to be created on the same engine the requests use;
    building state explicitly here keeps that guaranteed and keeps each test
    isolated from the developer's on-disk database file.
    """
    app = create_app()

    database = Database(settings)
    await database.create_schema()

    async with database.session_factory() as session:
        await seed_policies(
            session,
            target_total=settings.seed_policy_count,
            random_seed=settings.seed_random_seed,
        )

    app.state.settings = settings
    app.state.database = database
    app.state.cache = InMemoryCache(max_entries=settings.cache_max_entries)
    app.state.llm_provider = MockLlmProvider()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        # Hand the cache to tests that assert on hit/miss behaviour.
        http_client.cache = app.state.cache  # type: ignore[attr-defined]
        yield http_client

    await database.dispose()
