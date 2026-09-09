"""SQLAlchemy mapping for the Policy aggregate.

The ORM row is a separate type from the domain object (`app.domain.policy`)
rather than the domain object being decorated with mapper metadata: it keeps
persistence concerns - column types, indexes, string-valued enums - out of the
aggregate, and gives an obvious place to translate between the two.

Enums are stored as their wire strings (via `WireEnum.value`), not as ordinals.
An ordinal column silently reinterprets every existing row when someone inserts
a new member in the middle of the enum; a string column just fails to parse,
which is the failure you want.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, Index, Numeric, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.domain.enums import Currency, LineOfBusiness, PolicyStatus, Region
from app.domain.policy import Policy


class Base(DeclarativeBase):
    pass


class PolicyRecord(Base):
    __tablename__ = "policies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    policy_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    policyholder_name: Mapped[str] = mapped_column(String(200), index=True)
    line_of_business: Mapped[str] = mapped_column(String(32), index=True)
    status: Mapped[str] = mapped_column(String(16), index=True)
    premium_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(3))
    effective_date: Mapped[date] = mapped_column(Date, index=True)
    expiry_date: Mapped[date] = mapped_column(Date, index=True)
    region: Mapped[str] = mapped_column(String(32), index=True)
    underwriter: Mapped[str] = mapped_column(String(200), index=True)
    flagged_for_review: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    # The dashboard's default view is "active policies expiring soon", and the
    # list is sorted by createdAt desc; these two cover both without a scan.
    __table_args__ = (
        Index("ix_policies_status_expiry", "status", "expiry_date"),
        Index("ix_policies_created_at", "created_at"),
    )

    # ----- Mapping -----

    @classmethod
    def from_domain(cls, policy: Policy) -> "PolicyRecord":
        return cls(
            id=str(policy.id),
            policy_number=policy.policy_number,
            policyholder_name=policy.policyholder_name,
            line_of_business=policy.line_of_business.value,
            status=policy.status.value,
            premium_amount=policy.premium_amount,
            currency=policy.currency.value,
            effective_date=policy.effective_date,
            expiry_date=policy.expiry_date,
            region=policy.region.value,
            underwriter=policy.underwriter,
            flagged_for_review=policy.flagged_for_review,
            created_at=policy.created_at,
            updated_at=policy.updated_at,
        )

    def to_domain(self) -> Policy:
        return Policy(
            id=uuid.UUID(self.id),
            policy_number=self.policy_number,
            policyholder_name=self.policyholder_name,
            line_of_business=LineOfBusiness.from_wire(self.line_of_business),  # type: ignore[arg-type]
            status=PolicyStatus.from_wire(self.status),  # type: ignore[arg-type]
            premium_amount=self.premium_amount,
            currency=Currency.from_wire(self.currency),  # type: ignore[arg-type]
            effective_date=self.effective_date,
            expiry_date=self.expiry_date,
            region=Region.from_wire(self.region),  # type: ignore[arg-type]
            underwriter=self.underwriter,
            flagged_for_review=self.flagged_for_review,
            created_at=as_utc(self.created_at),
            updated_at=as_utc(self.updated_at),
        )


def as_utc(value: datetime) -> datetime:
    """SQLite has no native timezone-aware type and hands back naive datetimes;
    re-stamp them as UTC so the API always emits an offset."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
