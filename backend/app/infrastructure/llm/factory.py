"""Chooses the LLM provider from configuration.

The single place the application decides which model answers. `auto` (the
default) prefers Cerebras when an API key is configured and falls back to the
mock otherwise, so a fresh clone runs end to end without credentials and the
same clone upgrades to live inference by setting one environment variable.
"""

from __future__ import annotations

import logging

from app.application.ports import LlmProvider
from app.core.config import Settings
from app.infrastructure.llm.cerebras_provider import CerebrasLlmProvider
from app.infrastructure.llm.mock_provider import MockLlmProvider

logger = logging.getLogger(__name__)


def build_llm_provider(settings: Settings) -> LlmProvider:
    choice = settings.llm_provider

    if choice == "mock":
        logger.info("LLM provider: mock (explicitly configured).")
        return MockLlmProvider()

    if choice == "auto" and not settings.cerebras_api_key:
        logger.warning(
            "LLM provider: mock (no CEREBRAS_API_KEY configured). "
            "Set CEREBRAS_API_KEY to use live Cerebras inference."
        )
        return MockLlmProvider()

    if not settings.cerebras_api_key:
        # Explicitly asked for Cerebras with no key: fail loudly at startup
        # rather than at the first user prompt.
        raise RuntimeError("LLM_PROVIDER=cerebras requires CEREBRAS_API_KEY to be set.")

    logger.info("LLM provider: cerebras.", extra={"model": settings.cerebras_model})
    return CerebrasLlmProvider(
        api_key=settings.cerebras_api_key,
        model=settings.cerebras_model,
        temperature=settings.llm_temperature,
        max_tokens=settings.llm_max_tokens,
        timeout_seconds=settings.llm_timeout_seconds,
    )
