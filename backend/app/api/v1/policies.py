"""Policy REST endpoints - GET /api/v1/policies and friends."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import get_policy_commands, get_policy_queries, policy_filter_params, summary_filter_params
from app.application.dto import (
    FlagPoliciesRequest,
    FlagPoliciesResult,
    PagedResult,
    PolicyDto,
    PolicySummaryDto,
)
from app.application.filters import PolicyFilter
from app.application.ports import PolicyCommandService, PolicyQueryService
from app.core.errors import PolicyNotFoundError

router = APIRouter(prefix="/policies", tags=["Policies"])


@router.get(
    "",
    response_model=PagedResult[PolicyDto],
    summary="List policies",
    description="Filter, search, sort and page the policy register.",
)
async def list_policies(
    request: Annotated[PolicyFilter, Depends(policy_filter_params)],
    queries: Annotated[PolicyQueryService, Depends(get_policy_queries)],
) -> PagedResult[PolicyDto]:
    return await queries.get_policies(request)


@router.get(
    "/summary",
    response_model=PolicySummaryDto,
    summary="Portfolio summary",
    description=(
        "Aggregations over the same filtered set as GET /policies, so the KPIs always "
        "describe exactly what the caller is looking at."
    ),
)
async def get_summary(
    request: Annotated[PolicyFilter, Depends(summary_filter_params)],
    queries: Annotated[PolicyQueryService, Depends(get_policy_queries)],
) -> PolicySummaryDto:
    return await queries.get_summary(request)


@router.get(
    "/{policy_id}",
    response_model=PolicyDto,
    summary="Get a policy by id",
    responses={404: {"description": "No policy with that id."}},
)
async def get_policy(
    policy_id: uuid.UUID,
    queries: Annotated[PolicyQueryService, Depends(get_policy_queries)],
) -> PolicyDto:
    policy = await queries.get_by_id(policy_id)
    if policy is None:
        raise PolicyNotFoundError(str(policy_id))
    return policy


@router.patch(
    "/flag",
    response_model=FlagPoliciesResult,
    status_code=status.HTTP_200_OK,
    summary="Flag policies for review",
    description="Idempotent: flagging an already-flagged policy is a no-op that still reports it.",
)
async def flag_policies(
    body: FlagPoliciesRequest,
    commands: Annotated[PolicyCommandService, Depends(get_policy_commands)],
) -> FlagPoliciesResult:
    flagged = await commands.flag_policies(body.policy_ids)
    return FlagPoliciesResult(flagged_policy_ids=flagged)
