"""Wire contracts for the AI endpoints."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import Field

from app.application.dto import CamelModel

MAX_PROMPT_LENGTH = 2000


class AiScope(CamelModel):
    """The filter the user currently has applied in the UI.

    Sent with every AI request so the model answers about the set on screen
    rather than the whole book - the difference between a demo and a feature.
    Mirrors the query parameters of GET /policies, minus paging and sort.
    """

    status: str | None = None
    line_of_business: str | None = None
    region: str | None = None
    effective_date_from: date | None = None
    effective_date_to: date | None = None
    search: str | None = None
    flagged: bool | None = None


class MessageTurn(CamelModel):
    role: Literal["user", "assistant"]
    content: str


class PromptRequest(CamelModel):
    prompt: Annotated[str, Field(min_length=1, max_length=MAX_PROMPT_LENGTH)]
    scope: AiScope | None = None
    history: list[MessageTurn] | None = None


class PortfolioBriefRequest(CamelModel):
    scope: AiScope | None = None


class AiUsage(CamelModel):
    """Provenance for every AI response.

    Surfaced in the UI rather than logged only: a reviewer can see which
    provider and model answered, whether the answer came from the in-memory
    cache, and how long it took - which is also the evidence that the caching
    requirement is doing something.
    """

    provider: str
    model: str
    latency_ms: int
    cached: bool


class PromptResponse(CamelModel):
    id: uuid.UUID
    prompt: str
    answer: str
    context_summary: str
    usage: AiUsage
    created_at: datetime


class RiskFactor(CamelModel):
    description: str


class RiskAssessmentResponse(CamelModel):
    policy_id: uuid.UUID
    policy_number: str
    risk_score: Annotated[int, Field(ge=0, le=100)]
    risk_band: Literal["Low", "Medium", "High"]
    factors: list[str]
    recommendation: str
    suggest_flag: bool
    summary: str
    usage: AiUsage
    created_at: datetime


class PortfolioBriefResponse(CamelModel):
    brief: str
    context_summary: str
    usage: AiUsage
    created_at: datetime


class AiHealthResponse(CamelModel):
    provider: str
    model: str
    live_inference: bool
    detail: str
