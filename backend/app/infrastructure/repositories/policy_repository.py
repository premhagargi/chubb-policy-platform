"""SQL-backed implementations of the policy query and command ports.

Filtering, sorting, paging and the summary aggregations are all pushed into SQL:
every endpoint issues a bounded number of statements and never materialises the
table into Python. The filter predicate is built once (`_apply_filters`) and
reused by both the list and the summary path, so the summary can never describe
a different set than the list it accompanies.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Sequence

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dto import PagedResult, PolicyDto, PolicySummaryDto
from app.application.filters import PolicyFilter
from app.domain.enums import PolicyStatus
from app.domain.policy import EXPIRING_SOON_DAYS
from app.infrastructure.db.models import PolicyRecord, as_utc


class SqlPolicyQueryService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_policies(self, request: PolicyFilter) -> PagedResult[PolicyDto]:
        base = _apply_filters(select(PolicyRecord), request)

        total_count = await self._session.scalar(
            select(func.count()).select_from(base.subquery())
        )

        sort = request.sort_spec
        column = getattr(PolicyRecord, sort.column)
        ordered = base.order_by(column.desc() if sort.descending else column.asc())

        rows = await self._session.scalars(ordered.offset(request.offset).limit(request.size))

        return PagedResult[PolicyDto](
            items=[_to_dto(row) for row in rows],
            page=request.page,
            size=request.size,
            total_count=int(total_count or 0),
        )

    async def get_by_id(self, policy_id: uuid.UUID) -> PolicyDto | None:
        row = await self._session.scalar(
            select(PolicyRecord).where(PolicyRecord.id == str(policy_id))
        )
        return _to_dto(row) if row else None

    async def get_summary(self, request: PolicyFilter) -> PolicySummaryDto:
        filtered = _apply_filters(select(PolicyRecord), request).subquery()

        status_rows = await self._session.execute(
            select(filtered.c.status, func.count()).group_by(filtered.c.status)
        )
        lob_rows = await self._session.execute(
            select(filtered.c.line_of_business, func.sum(filtered.c.premium_amount)).group_by(
                filtered.c.line_of_business
            )
        )
        region_rows = await self._session.execute(
            select(filtered.c.region, func.count()).group_by(filtered.c.region)
        )
        region_premium_rows = await self._session.execute(
            select(filtered.c.region, func.sum(filtered.c.premium_amount)).group_by(filtered.c.region)
        )

        today = date.today()
        horizon = today + timedelta(days=EXPIRING_SOON_DAYS)
        expiring_soon = await self._session.scalar(
            select(func.count())
            .select_from(filtered)
            .where(
                filtered.c.status == PolicyStatus.ACTIVE.value,
                filtered.c.expiry_date >= today,
                filtered.c.expiry_date <= horizon,
            )
        )

        flagged = await self._session.scalar(
            select(func.count()).select_from(filtered).where(filtered.c.flagged_for_review.is_(True))
        )
        total = await self._session.scalar(select(func.count()).select_from(filtered))

        return PolicySummaryDto(
            counts_by_status={status: int(count) for status, count in status_rows},
            premium_by_line_of_business={
                lob: Decimal(total_premium or 0) for lob, total_premium in lob_rows
            },
            expiring_soon_count=int(expiring_soon or 0),
            flagged_count=int(flagged or 0),
            total_count=int(total or 0),
            counts_by_region={region: int(count) for region, count in region_rows},
            premium_by_region={
                region: Decimal(total_premium or 0) for region, total_premium in region_premium_rows
            },
        )


class SqlPolicyCommandService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def flag_policies(self, policy_ids: Sequence[uuid.UUID]) -> list[uuid.UUID]:
        """Load-mutate-commit rather than a bulk UPDATE: the set is bounded by
        the request (max 500 ids), and going through `Policy.flag()` keeps the
        `updated_at` stamp an aggregate concern instead of duplicating it in
        SQL."""
        ids = [str(policy_id) for policy_id in policy_ids]
        rows = list(await self._session.scalars(select(PolicyRecord).where(PolicyRecord.id.in_(ids))))

        if not rows:
            return []

        for row in rows:
            policy = row.to_domain()
            policy.flag()
            row.flagged_for_review = policy.flagged_for_review
            row.updated_at = policy.updated_at

        await self._session.commit()
        return [uuid.UUID(row.id) for row in rows]


# --------------------------------------------------------------------------- #
# Query building
# --------------------------------------------------------------------------- #


def _apply_filters(stmt: Select, request: PolicyFilter) -> Select:
    if request.status is not None:
        stmt = stmt.where(PolicyRecord.status == request.status.value)

    if request.line_of_business is not None:
        stmt = stmt.where(PolicyRecord.line_of_business == request.line_of_business.value)

    if request.region is not None:
        stmt = stmt.where(PolicyRecord.region == request.region.value)

    if request.effective_date_from is not None:
        stmt = stmt.where(PolicyRecord.effective_date >= request.effective_date_from)

    if request.effective_date_to is not None:
        stmt = stmt.where(PolicyRecord.effective_date <= request.effective_date_to)

    if request.flagged is not None:
        stmt = stmt.where(PolicyRecord.flagged_for_review.is_(request.flagged))

    if request.search:
        # lower(col) LIKE %term% rather than ILIKE: ILIKE is Postgres-only and
        # this has to run on SQLite too. Leading-wildcard search does not use an
        # index - acceptable at POC data volumes, and the point at which a real
        # deployment wants a trigram index or a search service.
        term = f"%{request.search.strip().lower()}%"
        stmt = stmt.where(
            func.lower(PolicyRecord.policy_number).like(term)
            | func.lower(PolicyRecord.policyholder_name).like(term)
            | func.lower(PolicyRecord.underwriter).like(term)
        )

    return stmt


def _to_dto(row: PolicyRecord) -> PolicyDto:
    return PolicyDto(
        id=uuid.UUID(row.id),
        policy_number=row.policy_number,
        policyholder_name=row.policyholder_name,
        line_of_business=row.line_of_business,
        status=row.status,
        premium_amount=row.premium_amount,
        currency=row.currency,
        effective_date=row.effective_date,
        expiry_date=row.expiry_date,
        region=row.region,
        underwriter=row.underwriter,
        flagged_for_review=row.flagged_for_review,
        created_at=as_utc(row.created_at),
        updated_at=as_utc(row.updated_at),
    )
