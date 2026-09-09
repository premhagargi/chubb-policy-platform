"""Cerebras adapter for the `LlmProvider` port.

Wraps the official `cerebras_cloud_sdk` async client. The SDK is imported lazily
inside the constructor so the package stays an optional dependency at runtime:
running the POC on the mock provider must not require it to be installed.

Every upstream failure is translated to `LlmProviderError` (HTTP 502) rather
than escaping as a vendor exception, so the API surface does not leak the
provider's exception hierarchy to clients.
"""

from __future__ import annotations

import logging
import re
from typing import Any, AsyncIterator

from app.core.errors import LlmProviderError

logger = logging.getLogger(__name__)


class CerebrasLlmProvider:
    name = "cerebras"

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        temperature: float = 0.2,
        max_tokens: int = 900,
        timeout_seconds: float = 30.0,
    ) -> None:
        try:
            from cerebras.cloud.sdk import AsyncCerebras
        except ImportError as exc:  # pragma: no cover - dependency is declared
            raise LlmProviderError(
                "cerebras_cloud_sdk is not installed. Install requirements.txt or set LLM_PROVIDER=mock."
            ) from exc

        self.model = model
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._client = AsyncCerebras(api_key=api_key, timeout=timeout_seconds)

    async def complete(self, *, system_prompt: str, user_prompt: str) -> str:
        try:
            response = await self._client.chat.completions.create(
                model=self.model,
                messages=self._messages(system_prompt, user_prompt),
                temperature=self._temperature,
                max_completion_tokens=self._max_tokens,
            )
        except Exception as exc:
            logger.exception("Cerebras completion failed.", extra={"model": self.model})
            raise LlmProviderError(f"Cerebras request failed: {exc}") from exc

        return _first_choice_content(response)

    async def stream(self, *, system_prompt: str, user_prompt: str) -> AsyncIterator[str]:
        try:
            stream = await self._client.chat.completions.create(
                model=self.model,
                messages=self._messages(system_prompt, user_prompt),
                temperature=self._temperature,
                max_completion_tokens=self._max_tokens,
                stream=True,
            )

            async for chunk in stream:
                delta = _delta_content(chunk)
                if delta:
                    yield delta
        except LlmProviderError:
            raise
        except Exception as exc:
            logger.exception("Cerebras stream failed.", extra={"model": self.model})
            raise LlmProviderError(f"Cerebras stream failed: {exc}") from exc

    @staticmethod
    def _messages(system_prompt: str, user_prompt: str) -> list[dict[str, str]]:
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]


def _first_choice_content(response: Any) -> str:
    choices = getattr(response, "choices", None)
    if not choices:
        raise LlmProviderError("Cerebras returned no completion choices.")

    choice = choices[0]
    content = getattr(choice.message, "content", None)

    if not content:
        # Reasoning models spend part of `max_completion_tokens` on hidden
        # reasoning before emitting any content; if the budget runs out first the
        # SDK returns a successful response with `content: None`. Say which knob
        # to turn rather than reporting a bare "empty completion".
        if getattr(choice, "finish_reason", None) == "length":
            raise LlmProviderError(
                "The model exhausted its token budget on reasoning before producing an "
                "answer. Increase LLM_MAX_TOKENS."
            )
        raise LlmProviderError("Cerebras returned an empty completion.")

    return strip_reasoning(content)


def _delta_content(chunk: Any) -> str | None:
    choices = getattr(chunk, "choices", None)
    if not choices:
        return None

    delta = getattr(choices[0], "delta", None)
    return getattr(delta, "content", None) if delta else None


_THINK_BLOCK = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def strip_reasoning(text: str) -> str:
    """Remove any inline reasoning block the model emitted.

    Cerebras returns reasoning separately for the models used here, but Qwen-style
    models can still inline a `<think>` block when the budget is tight. Stripping
    it here keeps that an adapter concern rather than something every consumer
    (and the JSON parser in `ai_service`) has to know about.
    """
    return _THINK_BLOCK.sub("", text).strip()
