"""Orchestration for the three AI features.

Each feature follows the same three steps:

1. **Ground** - read the live policy data the question is about, through the
   same cached query service the REST endpoints use, so the model and the
   dashboard can never disagree.
2. **Prompt** - build system/user text from `app.application.prompts`.
3. **Cache + call** - key on (task, model, prompt content) and reuse an
   identical earlier answer for the TTL window.

The cache key includes the resolved model name, so switching `CEREBRAS_MODEL`
does not serve answers from the previous model; and because the shared
`InMemoryCache` generation is bumped by any policy mutation, flagging a policy
also invalidates AI answers that were grounded in the pre-flag numbers.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import time
import uuid
from datetime import date, datetime, timezone
from typing import AsyncIterator

from app.application.ai_dto import (
    AiUsage,
    PortfolioBriefResponse,
    PromptResponse,
    RiskAssessmentResponse,
)
from app.application.dto import PolicyDto
from app.application.filters import PolicyFilter
from app.application.ports import LlmProvider, PolicyQueryService
from app.application.references import MAX_POLICIES as MAX_REFERENCED_POLICIES
from app.application.references import extract_search_terms
from app.application.prompts import (
    BRIEF_SYSTEM,
    COPILOT_SYSTEM,
    RISK_SYSTEM,
    build_brief_user_prompt,
    build_copilot_user_prompt,
    build_portfolio_context,
    build_risk_user_prompt,
    describe_scope,
)
from app.core.cache import InMemoryCache
from app.core.errors import LlmProviderError, PolicyNotFoundError
from app.domain.policy import EXPIRING_SOON_DAYS

logger = logging.getLogger(__name__)

#: How many concrete policies to include alongside the aggregates. Enough for the
#: model to cite real records, small enough to keep the prompt bounded.
CONTEXT_SAMPLE_SIZE = 12

#: Rows fetched per resolved reference term. Small: a policy number matches one
#: row, and a name match beyond a handful is noise rather than context.
REFERENCE_LOOKUP_SIZE = 4


class AiService:
    def __init__(
        self,
        *,
        query_service: PolicyQueryService,
        provider: LlmProvider,
        cache: InMemoryCache,
        cache_ttl_seconds: float,
    ) -> None:
        self._queries = query_service
        self._provider = provider
        self._cache = cache
        self._ttl = cache_ttl_seconds

    # ----- Feature 1: Policy Copilot ------------------------------------- #

    async def answer_prompt(self, question: str, scope: PolicyFilter) -> PromptResponse:
        context = await self._portfolio_context(scope, question=question)
        user_prompt = build_copilot_user_prompt(question, context)

        answer, usage = await self._complete(
            task="copilot", system_prompt=COPILOT_SYSTEM, user_prompt=user_prompt
        )

        return PromptResponse(
            id=uuid.uuid4(),
            prompt=question,
            answer=answer,
            context_summary=describe_scope(scope),
            usage=usage,
            created_at=_now(),
        )

    async def stream_prompt(self, question: str, scope: PolicyFilter) -> AsyncIterator[str]:
        """Token stream for the same feature.

        Not cached: a cache hit would defeat the purpose of streaming, and the
        non-streaming endpoint already covers repeat questions.
        """
        context = await self._portfolio_context(scope, question=question)
        user_prompt = build_copilot_user_prompt(question, context)

        async for token in self._provider.stream(
            system_prompt=COPILOT_SYSTEM, user_prompt=user_prompt
        ):
            yield token

    # ----- Feature 2: Per-policy risk assessment -------------------------- #

    async def assess_policy(self, policy_id: uuid.UUID) -> RiskAssessmentResponse:
        policy = await self._queries.get_by_id(policy_id)
        if policy is None:
            raise PolicyNotFoundError(str(policy_id))

        expiring_soon = _is_expiring_soon(policy)
        user_prompt = build_risk_user_prompt(
            policy, expiring_soon=expiring_soon, today=date.today()
        )

        raw, usage = await self._complete(
            task="risk", system_prompt=RISK_SYSTEM, user_prompt=user_prompt
        )
        parsed = _parse_risk_json(raw, policy)

        return RiskAssessmentResponse(
            policy_id=policy.id,
            policy_number=policy.policy_number,
            usage=usage,
            created_at=_now(),
            **parsed,
        )

    # ----- Feature 3: Portfolio brief ------------------------------------- #

    async def portfolio_brief(self, scope: PolicyFilter) -> PortfolioBriefResponse:
        context = await self._portfolio_context(scope)
        brief, usage = await self._complete(
            task="brief", system_prompt=BRIEF_SYSTEM, user_prompt=build_brief_user_prompt(context)
        )

        return PortfolioBriefResponse(
            brief=brief,
            context_summary=describe_scope(scope),
            usage=usage,
            created_at=_now(),
        )

    # ----- internals ------------------------------------------------------ #

    async def _portfolio_context(self, scope: PolicyFilter, *, question: str | None = None) -> str:
        """Read aggregates plus a bounded sample through the cached query
        service - the AI path pays the same cache benefit as the REST path.

        When the question names a specific policy (a number, a quoted term, a
        policyholder), those records are looked up and appended: the statistical
        sample almost never contains the one row the user asked about, and
        without this the model can only say the context lacks it.
        """
        summary = await self._queries.get_summary(scope)
        page = await self._queries.get_policies(self._sample_filter(scope))

        referenced = await self._referenced_policies(question, scope) if question else []

        return build_portfolio_context(summary, page.items, scope, referenced=referenced)

    def _sample_filter(self, scope: PolicyFilter, **overrides) -> PolicyFilter:
        """A copy of the scope with paging/sort set for context building."""
        base = dict(
            page=1,
            size=CONTEXT_SAMPLE_SIZE,
            sort="premiumAmount,desc",
            status=scope.status,
            line_of_business=scope.line_of_business,
            region=scope.region,
            effective_date_from=scope.effective_date_from,
            effective_date_to=scope.effective_date_to,
            search=scope.search,
            flagged=scope.flagged,
        )
        return PolicyFilter(**{**base, **overrides})

    async def _referenced_policies(self, question: str, scope: PolicyFilter) -> list[PolicyDto]:
        """Resolve entities named in the question to actual policy records.

        Lookups run against the *unscoped* register rather than the active
        filter: asking about a policy number while the Flagged view is open
        should still find it, and answering "that policy is not in your current
        filter" is more useful than "I have no record of it".
        """
        terms = extract_search_terms(question)
        if not terms:
            return []

        found: dict[uuid.UUID, PolicyDto] = {}

        for term in terms:
            page = await self._queries.get_policies(
                PolicyFilter(page=1, size=REFERENCE_LOOKUP_SIZE, sort="premiumAmount,desc", search=term)
            )
            for policy in page.items:
                found.setdefault(policy.id, policy)

            if len(found) >= MAX_REFERENCED_POLICIES:
                break

        return list(found.values())[:MAX_REFERENCED_POLICIES]

    async def _complete(
        self, *, task: str, system_prompt: str, user_prompt: str
    ) -> tuple[str, AiUsage]:
        key = _cache_key(task, self._provider.model, system_prompt, user_prompt)
        started = time.perf_counter()

        answer, was_cached = await self._cache.aget_or_set(
            key,
            lambda: self._provider.complete(system_prompt=system_prompt, user_prompt=user_prompt),
            self._ttl,
        )

        latency_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "AI completion served.",
            extra={
                "task": task,
                "provider": self._provider.name,
                "model": self._provider.model,
                "cached": was_cached,
                "latency_ms": latency_ms,
            },
        )

        return answer, AiUsage(
            provider=self._provider.name,
            model=self._provider.model,
            latency_ms=latency_ms,
            cached=was_cached,
        )


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _cache_key(task: str, model: str, system_prompt: str, user_prompt: str) -> str:
    """Hash the prompt rather than storing it: prompts embed the whole portfolio
    context and would make cache keys kilobytes long."""
    digest = hashlib.sha256(f"{system_prompt}\x00{user_prompt}".encode("utf-8")).hexdigest()
    return f"ai:{task}:{model}:{digest[:32]}"


def _is_expiring_soon(policy: PolicyDto) -> bool:
    from datetime import timedelta

    today = date.today()
    return (
        policy.status == "Active"
        and today <= policy.expiry_date <= today + timedelta(days=EXPIRING_SOON_DAYS)
    )


_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)
_VALID_BANDS = {"Low", "Medium", "High"}


def _parse_risk_json(raw: str, policy: PolicyDto) -> dict[str, object]:
    """Parse the model's JSON answer defensively.

    A model can wrap JSON in a code fence or add a sentence before it despite
    instructions, so the first `{...}` block is extracted rather than parsing the
    whole response. Every field is then range-checked - an out-of-band score or
    a missing key must not reach the UI as a 500.
    """
    match = _JSON_BLOCK.search(raw)
    if not match:
        raise LlmProviderError("The AI response did not contain a JSON risk assessment.")

    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise LlmProviderError(f"The AI risk assessment was not valid JSON: {exc}") from exc

    if not isinstance(data, dict):
        raise LlmProviderError("The AI risk assessment was not a JSON object.")

    try:
        score = int(data.get("riskScore", 0))
    except (TypeError, ValueError):
        score = 0
    score = max(0, min(100, score))

    band = data.get("riskBand")
    if band not in _VALID_BANDS:
        # Derive from the score rather than rejecting the whole response.
        band = "High" if score >= 70 else "Medium" if score >= 45 else "Low"

    raw_factors = data.get("factors") or []
    factors = [str(f) for f in raw_factors if str(f).strip()][:4] if isinstance(raw_factors, list) else []
    if not factors:
        factors = ["The model did not identify specific risk factors for this policy."]

    return {
        "risk_score": score,
        "risk_band": band,
        "factors": factors,
        "recommendation": str(data.get("recommendation") or "No recommendation was returned."),
        "suggest_flag": bool(data.get("suggestFlag", False)) and not policy.flagged_for_review,
        "summary": str(data.get("summary") or f"Risk assessed as {band} ({score}/100)."),
    }
