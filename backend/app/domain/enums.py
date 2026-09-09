"""Domain enums and their wire representations.

Two of these have display forms that are not valid Python identifiers - "A&H"
and "Hong Kong" - so, exactly as in the previous C# implementation, the wire/DB
string is defined once on the enum member and both the persistence mapping and
the API serialisation go through it. Nothing calls `str(member)` or `.name` to
build a wire value, so the two can never drift apart.
"""

from __future__ import annotations

from enum import Enum


class WireEnum(Enum):
    """Enum whose value *is* its wire/DB representation, with a
    case-insensitive, whitespace-tolerant parser for query-string input."""

    @classmethod
    def from_wire(cls, value: str) -> "WireEnum":
        normalised = value.strip().casefold()
        for member in cls:
            if member.value.casefold() == normalised:
                return member
        raise ValueError(
            f"'{value}' is not a valid {cls.__name__}. "
            f"Expected one of: {', '.join(m.value for m in cls)}."
        )

    @classmethod
    def try_from_wire(cls, value: str) -> "WireEnum | None":
        try:
            return cls.from_wire(value)
        except ValueError:
            return None

    @classmethod
    def wire_values(cls) -> list[str]:
        return [member.value for member in cls]

    def __str__(self) -> str:
        return self.value


class PolicyStatus(WireEnum):
    ACTIVE = "Active"
    EXPIRED = "Expired"
    PENDING = "Pending"
    CANCELLED = "Cancelled"


class LineOfBusiness(WireEnum):
    PROPERTY = "Property"
    CASUALTY = "Casualty"
    ACCIDENT_AND_HEALTH = "A&H"
    MARINE = "Marine"


class Region(WireEnum):
    SINGAPORE = "Singapore"
    HONG_KONG = "Hong Kong"
    AUSTRALIA = "Australia"
    JAPAN = "Japan"
    THAILAND = "Thailand"
    INDONESIA = "Indonesia"
    MALAYSIA = "Malaysia"
    PHILIPPINES = "Philippines"


class Currency(WireEnum):
    USD = "USD"
    SGD = "SGD"
    HKD = "HKD"
    AUD = "AUD"
    JPY = "JPY"
    THB = "THB"


REGION_CURRENCY: dict[Region, Currency] = {
    Region.SINGAPORE: Currency.SGD,
    Region.HONG_KONG: Currency.HKD,
    Region.AUSTRALIA: Currency.AUD,
    Region.JAPAN: Currency.JPY,
    Region.THAILAND: Currency.THB,
}


def currency_for_region(region: Region) -> Currency:
    """Regions without a local trading currency are written in USD."""
    return REGION_CURRENCY.get(region, Currency.USD)
