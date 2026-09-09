"""Async engine / session factory and schema bootstrap."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import Settings
from app.infrastructure.db.models import Base

logger = logging.getLogger(__name__)


class Database:
    """Owns the engine for the process lifetime. Held on `app.state` and closed
    on shutdown, so no connection outlives the application."""

    def __init__(self, settings: Settings) -> None:
        connect_args: dict[str, object] = {}
        if settings.is_sqlite:
            # The seeder and request handlers touch the connection from different
            # tasks; SQLite's default same-thread guard rejects that.
            connect_args["check_same_thread"] = False

        self.engine: AsyncEngine = create_async_engine(
            settings.database_url,
            echo=False,
            future=True,
            pool_pre_ping=not settings.is_sqlite,
            connect_args=connect_args,
        )
        self.session_factory = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )

    async def create_schema(self) -> None:
        """Create tables if absent.

        `create_all` rather than a migration run: the POC ships a single schema
        version with no upgrade path to honour. A real deployment wants Alembic
        plus a dedicated migration job - recorded as a known trade-off in
        docs/ARCHITECTURE.md.
        """
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database schema ready.")

    async def dispose(self) -> None:
        await self.engine.dispose()

    async def session(self) -> AsyncIterator[AsyncSession]:
        async with self.session_factory() as session:
            yield session
