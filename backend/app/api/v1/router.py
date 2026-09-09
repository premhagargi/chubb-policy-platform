"""Aggregates every v1 route under a single `/api/v1` prefix.

Versioning lives here rather than on individual routers, so a future v2 is a new
module mounted alongside this one instead of an edit to every endpoint.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import ai, policies, system

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(policies.router)
api_router.include_router(ai.router)
api_router.include_router(system.router)
