"""AI endpoints - the end-to-end prompt flow.

Three features over one provider abstraction:

* ``POST /ai/prompt``        - Policy Copilot, grounded in the filter on screen.
* ``POST /ai/prompt/stream`` - the same question as a token stream (SSE).
* ``POST /ai/policies/{id}/risk-assessment`` - structured per-policy triage.
* ``POST /ai/portfolio-brief`` - three-bullet executive narrative.

Every response carries a `usage` block (provider, model, latency, cache hit) so
the client can show where the answer came from.
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Annotated, AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.deps import get_ai_service, get_app_settings, get_llm_provider
from app.application.ai_dto import (
    AiHealthResponse,
    AiScope,
    PortfolioBriefRequest,
    PortfolioBriefResponse,
    PromptRequest,
    PromptResponse,
    RiskAssessmentResponse,
)
from app.application.ai_service import AiService
from app.application.filters import PolicyFilter, parse_policy_filter
from app.application.ports import LlmProvider
from app.core.config import Settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])


def _to_filter(scope: AiScope | None) -> PolicyFilter:
    """Reuse the exact validation the REST filters use, so an invalid scope on an
    AI request fails the same way it would on GET /policies."""
    if scope is None:
        return parse_policy_filter()

    return parse_policy_filter(
        status=scope.status,
        line_of_business=scope.line_of_business,
        region=scope.region,
        effective_date_from=scope.effective_date_from,
        effective_date_to=scope.effective_date_to,
        search=scope.search,
        flagged=scope.flagged,
    )


@router.get(
    "/health",
    response_model=AiHealthResponse,
    summary="Which provider and model are answering",
)
async def ai_health(
    provider: Annotated[LlmProvider, Depends(get_llm_provider)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> AiHealthResponse:
    live = provider.name != "mock"
    return AiHealthResponse(
        provider=provider.name,
        model=provider.model,
        live_inference=live,
        detail=(
            f"Live inference via Cerebras ({provider.model})."
            if live
            else "Running on the built-in mock provider. Set CEREBRAS_API_KEY for live inference."
        ),
    )


@router.post(
    "/prompt",
    response_model=PromptResponse,
    summary="Ask the Policy Copilot a question",
    description=(
        "Grounds the question in the caller's current filter - the summary aggregates "
        "plus a bounded sample of matching policies - then answers from that context."
    ),
)
async def ask(
    body: PromptRequest,
    ai: Annotated[AiService, Depends(get_ai_service)],
) -> PromptResponse:
    return await ai.answer_prompt(body.prompt, _to_filter(body.scope))


@router.post(
    "/prompt/stream",
    summary="Ask the Policy Copilot, streamed token by token",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/event-stream": {}}}},
)
async def ask_streaming(
    body: PromptRequest,
    ai: Annotated[AiService, Depends(get_ai_service)],
) -> StreamingResponse:
    scope = _to_filter(body.scope)

    async def events() -> AsyncIterator[str]:
        try:
            async for token in ai.stream_prompt(body.prompt, scope):
                yield _sse({"type": "token", "value": token})
            yield _sse({"type": "done"})
        except AppError as exc:
            # The status line is already committed by the time streaming starts,
            # so a mid-stream failure has to be reported inside the stream.
            logger.warning("AI stream failed.", extra={"error": str(exc)})
            yield _sse({"type": "error", "message": exc.message})
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("AI stream failed unexpectedly.")
            yield _sse({"type": "error", "message": "The AI response was interrupted."})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Stops nginx from buffering the stream into one response.
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/policies/{policy_id}/risk-assessment",
    response_model=RiskAssessmentResponse,
    summary="AI underwriting risk triage for one policy",
    description=(
        "Returns a structured assessment (score, band, factors, recommendation). "
        "`suggestFlag` is true when the model judges the policy worth flagging and it "
        "is not flagged already, which the UI offers as a one-click action."
    ),
    responses={404: {"description": "No policy with that id."}},
)
async def assess_policy(
    policy_id: uuid.UUID,
    ai: Annotated[AiService, Depends(get_ai_service)],
) -> RiskAssessmentResponse:
    return await ai.assess_policy(policy_id)


@router.post(
    "/portfolio-brief",
    response_model=PortfolioBriefResponse,
    summary="Three-bullet executive brief over the current filter",
)
async def portfolio_brief(
    body: PortfolioBriefRequest,
    ai: Annotated[AiService, Depends(get_ai_service)],
) -> PortfolioBriefResponse:
    return await ai.portfolio_brief(_to_filter(body.scope))


def _sse(payload: dict[str, object]) -> str:
    return f"data: {json.dumps(payload)}\n\n"
