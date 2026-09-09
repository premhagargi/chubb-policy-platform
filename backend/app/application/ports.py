"""Ports (interfaces) the API layer depends on.

Structural `Protocol`s rather than ABCs: the concrete implementations in
`app.infrastructure` never import this module, so the dependency arrow points
inward only - the Python equivalent of the C# `IPolicyQueryService` /
`IPolicyCommandService` split, minus the inheritance coupling.
"""

from __future__ import annotations

import uuid
from typing import AsyncIterator, Protocol, Sequence, runtime_checkable

from app.application.dto import PagedResult, PolicyDto, PolicySummaryDto
from app.application.filters import PolicyFilter


@runtime_checkable
class PolicyQueryService(Protocol):
    async def get_policies(self, request: PolicyFilter) -> PagedResult[PolicyDto]: ...

    async def get_by_id(self, policy_id: uuid.UUID) -> PolicyDto | None: ...

    async def get_summary(self, request: PolicyFilter) -> PolicySummaryDto: ...


@runtime_checkable
class PolicyCommandService(Protocol):
    async def flag_policies(self, policy_ids: Sequence[uuid.UUID]) -> list[uuid.UUID]: ...


@runtime_checkable
class LlmProvider(Protocol):
    """Everything the AI features need from a completion provider.

    Kept this narrow on purpose: swapping Cerebras for another vendor - or for
    the deterministic mock - is a single binding change in
    `app.infrastructure.llm.factory`, with no call site touched.
    """

    #: Reported back to the client so the UI can show which model answered.
    name: str
    model: str

    async def complete(self, *, system_prompt: str, user_prompt: str) -> str: ...

    def stream(self, *, system_prompt: str, user_prompt: str) -> AsyncIterator[str]: ...
