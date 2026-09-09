"""Application settings.

Single source of configuration, loaded from environment variables (and a local
`.env` when present). Mirrors what appsettings.json + IConfiguration did in the
previous .NET implementation, but with type coercion and validation supplied by
pydantic-settings rather than hand-written binding.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- General ---
    app_name: str = "Chubb APAC Policy Management Platform API"
    api_version: str = "v1"
    environment: Literal["Development", "Production"] = "Development"
    log_level: str = "INFO"

    # --- Persistence ---
    # SQLite by default so the POC runs with zero external dependencies; point
    # DATABASE_URL at postgresql+asyncpg://... to use Postgres instead.
    database_url: str = "sqlite+aiosqlite:///./chubb_policies.db"
    seed_policy_count: int = 220
    seed_random_seed: int = 20260503

    # --- CORS ---
    cors_allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:4200"])

    # --- In-memory cache TTLs (seconds) ---
    cache_list_ttl_seconds: int = 30
    cache_summary_ttl_seconds: int = 60
    cache_llm_ttl_seconds: int = 300
    cache_max_entries: int = 512

    # --- LLM provider ---
    # "auto" resolves to Cerebras when an API key is present, and to the
    # deterministic mock otherwise, so the demo never hard-fails on a missing key.
    llm_provider: Literal["auto", "cerebras", "mock"] = "auto"
    cerebras_api_key: str | None = None
    cerebras_model: str = "gpt-oss-120b"
    llm_temperature: float = 0.2
    # Reasoning models (qwen-3.x) spend part of this budget on hidden reasoning
    # tokens before emitting any content, so 900 left some tasks with an empty
    # completion. 4000 gives reasoning headroom and still bounds cost.
    llm_max_tokens: int = 4000
    llm_timeout_seconds: float = 30.0

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Accept both a JSON list and a plain comma-separated string, because a
        docker-compose `environment:` block can only supply the latter."""
        if isinstance(value, str) and not value.strip().startswith("["):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("cerebras_api_key", mode="before")
    @classmethod
    def _blank_key_is_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()
