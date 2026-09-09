"""Wire contracts (request/response models).

All models serialise in camelCase to match the OpenAPI contract the Angular
client was already written against, while staying snake_case in Python. Money
crosses the wire as a JSON number rather than a string: pydantic v2 renders
`Decimal` as a string in JSON mode by default, which would have silently broken
every numeric format/sum in the UI. Decimal remains the in-process type
(`app.domain.policy`); the conversion happens only at this boundary, and a
two-decimal premium capped at 5,000,000 is exactly representable in float64.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, computed_field
from pydantic.alias_generators import to_camel

T = TypeVar("T")

#: Decimal in, JSON number out.
Money = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# --------------------------------------------------------------------------- #
# Policies
# --------------------------------------------------------------------------- #


class PolicyDto(CamelModel):
    id: uuid.UUID
    policy_number: str
    policyholder_name: str
    line_of_business: str
    status: str
    premium_amount: Money
    currency: str
    effective_date: date
    expiry_date: date
    region: str
    underwriter: str
    flagged_for_review: bool
    created_at: datetime
    updated_at: datetime


class PagedResult(CamelModel, Generic[T]):
    items: list[T]
    page: int
    size: int
    total_count: int

    @computed_field  # type: ignore[prop-decorator]
    @property
    def total_pages(self) -> int:
        if self.size == 0:
            return 0
        return -(-self.total_count // self.size)  # ceil division


class PolicySummaryDto(CamelModel):
    counts_by_status: dict[str, int]
    premium_by_line_of_business: dict[str, Money]
    expiring_soon_count: int
    flagged_count: int
    total_count: int
    counts_by_region: dict[str, int]
    premium_by_region: dict[str, Money]


class FlagPoliciesRequest(CamelModel):
    policy_ids: Annotated[list[uuid.UUID], Field(min_length=1, max_length=500)]


class FlagPoliciesResult(CamelModel):
    flagged_policy_ids: list[uuid.UUID]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def flagged_count(self) -> int:
        return len(self.flagged_policy_ids)


# --------------------------------------------------------------------------- #
# Operational
# --------------------------------------------------------------------------- #


class CacheStatsDto(CamelModel):
    hits: int
    misses: int
    hit_rate: float
    entries: int
    generation: int
    evictions: int


class ErrorResponse(CamelModel):
    type: str
    title: str
    status: int
    correlation_id: uuid.UUID
    errors: dict[str, list[str]] | None = None
