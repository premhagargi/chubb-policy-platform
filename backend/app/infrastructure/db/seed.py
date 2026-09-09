"""Deterministic demo data.

Same shape as the previous Bogus-based C# seeder: a fixed random seed so every
run produces identical data, a deterministic sweep guaranteeing each
(status x line of business x region) combination appears at least once, then a
random fill to the target count.
"""

from __future__ import annotations

import logging
import random
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from faker import Faker
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import (
    Currency,
    LineOfBusiness,
    PolicyStatus,
    Region,
    currency_for_region,
)
from app.domain.policy import MAX_PREMIUM, MIN_PREMIUM, Policy
from app.infrastructure.db.models import PolicyRecord

logger = logging.getLogger(__name__)

#: Policies pushed into the "expiring soon" window so the summary metric is
#: non-trivial to verify.
EXPIRING_SOON_SAMPLE = 15

#: Policies pre-flagged so the flagged view is not empty on first load.
PRE_FLAGGED_SAMPLE = 10


async def seed_policies(
    session: AsyncSession,
    *,
    target_total: int = 220,
    random_seed: int = 20260503,
) -> int:
    """Insert demo policies if the table is empty. Returns the row count."""
    existing = await session.scalar(select(func.count()).select_from(PolicyRecord))
    if existing:
        logger.info("Policies table already populated - skipping seed.", extra={"rows": existing})
        return int(existing)

    logger.info("Seeding policies...", extra={"target": target_total})

    rng = random.Random(random_seed)
    faker = Faker()
    Faker.seed(random_seed)

    policies: list[Policy] = []
    policy_number = 100_000

    # Deterministic sweep first: every combination represented at least once.
    for status in PolicyStatus:
        for lob in LineOfBusiness:
            for region in Region:
                policies.append(_build(policy_number, status, lob, region, rng, faker))
                policy_number += 1

    while len(policies) < target_total:
        policies.append(
            _build(
                policy_number,
                rng.choice(list(PolicyStatus)),
                rng.choice(list(LineOfBusiness)),
                rng.choice(list(Region)),
                rng,
                faker,
            )
        )
        policy_number += 1

    today = date.today()
    active = [p for p in policies if p.status is PolicyStatus.ACTIVE][:EXPIRING_SOON_SAMPLE]
    for policy in active:
        policy.extend_expiry_to(today + timedelta(days=rng.randint(1, 30)))

    for policy in policies[:PRE_FLAGGED_SAMPLE]:
        policy.flag()

    session.add_all(PolicyRecord.from_domain(p) for p in policies)
    await session.commit()

    logger.info("Seeded policies.", extra={"rows": len(policies)})
    return len(policies)


def _build(
    suffix: int,
    status: PolicyStatus,
    lob: LineOfBusiness,
    region: Region,
    rng: random.Random,
    faker: Faker,
) -> Policy:
    effective_date = faker.date_between(start_date="-2y", end_date="today")
    # timedelta rather than replace(year=+1): a 29 February effective date has no
    # 29 February successor and replace() would raise.
    expiry_date = effective_date + timedelta(days=365)

    return Policy.create(
        policy_number=f"PCL-{suffix:06d}",
        policyholder_name=faker.name(),
        line_of_business=lob,
        status=status,
        premium_amount=_premium(rng),
        currency=_currency(region),
        effective_date=effective_date,
        expiry_date=expiry_date,
        region=region,
        underwriter=faker.name(),
    )


def _premium(rng: random.Random) -> Decimal:
    """Weighted low: sample twice and take the minimum, so most policies are
    modest with a few large commercial outliers, rather than a flat uniform
    spread that makes every chart look the same."""
    low, high = float(MIN_PREMIUM), float(MAX_PREMIUM)
    sample = min(rng.uniform(low, high), rng.uniform(low, high))
    return Decimal(sample).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _currency(region: Region) -> Currency:
    return currency_for_region(region)
