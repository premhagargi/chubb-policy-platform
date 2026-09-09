"""The Policy aggregate.

Invariants live here, not in the API layer or the ORM model, so a policy cannot
be constructed in an invalid state by any caller - the seeder and the repository
both go through `Policy.create`.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from decimal import Decimal

from app.domain.enums import Currency, LineOfBusiness, PolicyStatus, Region

MIN_PREMIUM = Decimal("1000")
MAX_PREMIUM = Decimal("5000000")

#: Window used by the "expiring soon" summary metric.
EXPIRING_SOON_DAYS = 30


def _utc_now() -> datetime:
    return datetime.now(tz=timezone.utc)


@dataclass(slots=True)
class Policy:
    id: uuid.UUID
    policy_number: str
    policyholder_name: str
    line_of_business: LineOfBusiness
    status: PolicyStatus
    premium_amount: Decimal
    currency: Currency
    effective_date: date
    expiry_date: date
    region: Region
    underwriter: str
    flagged_for_review: bool = False
    created_at: datetime = field(default_factory=_utc_now)
    updated_at: datetime = field(default_factory=_utc_now)

    @classmethod
    def create(
        cls,
        *,
        policy_number: str,
        policyholder_name: str,
        line_of_business: LineOfBusiness,
        status: PolicyStatus,
        premium_amount: Decimal,
        currency: Currency,
        effective_date: date,
        expiry_date: date,
        region: Region,
        underwriter: str,
        flagged_for_review: bool = False,
    ) -> "Policy":
        if not MIN_PREMIUM <= premium_amount <= MAX_PREMIUM:
            raise ValueError(
                f"Premium amount must be between {MIN_PREMIUM:,} and {MAX_PREMIUM:,}; got {premium_amount}."
            )

        if expiry_date <= effective_date:
            raise ValueError("Expiry date must be after the effective date.")

        now = _utc_now()
        return cls(
            id=uuid.uuid4(),
            policy_number=policy_number,
            policyholder_name=policyholder_name,
            line_of_business=line_of_business,
            status=status,
            premium_amount=premium_amount,
            currency=currency,
            effective_date=effective_date,
            expiry_date=expiry_date,
            region=region,
            underwriter=underwriter,
            flagged_for_review=flagged_for_review,
            created_at=now,
            updated_at=now,
        )

    def flag(self) -> None:
        self.flagged_for_review = True
        self.updated_at = _utc_now()

    def extend_expiry_to(self, new_expiry_date: date) -> None:
        """Renewal/extension: moves the expiry date out. A normal aggregate
        behaviour that the seeder also uses to produce a realistic spread of
        "expiring soon" policies - not a seeding-only backdoor."""
        if new_expiry_date <= self.effective_date:
            raise ValueError("Expiry date must be after the effective date.")

        self.expiry_date = new_expiry_date
        self.updated_at = _utc_now()

    def is_expiring_soon(self, today: date, horizon_days: int = EXPIRING_SOON_DAYS) -> bool:
        from datetime import timedelta

        return (
            self.status is PolicyStatus.ACTIVE
            and today <= self.expiry_date <= today + timedelta(days=horizon_days)
        )
