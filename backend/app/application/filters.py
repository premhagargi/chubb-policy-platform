"""Filter/sort/paging request model shared by the list and summary endpoints.

`GET /policies` and `GET /policies/summary` accept the same filters (the summary
ignores page/size/sort), so the summary numbers always describe exactly the set
the caller is currently looking at in the list.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.core.errors import ValidationError
from app.domain.enums import LineOfBusiness, PolicyStatus, Region

#: Fields accepted in a `sort` query parameter, mapped to the ORM column name.
#: Defined once so the request validator and the repository's ORDER BY can never
#: drift apart - both read this map rather than hard-coding their own list.
SORT_FIELDS: dict[str, str] = {
    "policynumber": "policy_number",
    "policyholdername": "policyholder_name",
    "lineofbusiness": "line_of_business",
    "status": "status",
    "premiumamount": "premium_amount",
    "effectivedate": "effective_date",
    "expirydate": "expiry_date",
    "region": "region",
    "underwriter": "underwriter",
    "createdat": "created_at",
}

SORT_FIELD_NAMES = (
    "policyNumber, policyholderName, lineOfBusiness, status, premiumAmount, "
    "effectiveDate, expiryDate, region, underwriter, createdAt"
)

MAX_PAGE_SIZE = 100
MAX_SEARCH_LENGTH = 200


@dataclass(frozen=True, slots=True)
class SortSpec:
    column: str
    descending: bool

    @classmethod
    def default(cls) -> "SortSpec":
        return cls(column="created_at", descending=True)

    @classmethod
    def parse(cls, raw: str | None) -> "SortSpec":
        """`?sort=premiumAmount,desc`. Raises ValueError on an unknown field so
        the caller gets a 400 rather than a silently ignored parameter."""
        if raw is None or not raw.strip():
            return cls.default()

        parts = [part.strip() for part in raw.split(",")]
        field = parts[0].casefold()
        descending = len(parts) > 1 and parts[1].casefold() == "desc"

        column = SORT_FIELDS.get(field)
        if column is None:
            raise ValueError(
                f"sort must reference one of: {SORT_FIELD_NAMES}, "
                'optionally followed by ",asc" or ",desc".'
            )

        return cls(column=column, descending=descending)


@dataclass(frozen=True, slots=True)
class PolicyFilter:
    page: int = 1
    size: int = 20
    sort: str | None = None
    status: PolicyStatus | None = None
    line_of_business: LineOfBusiness | None = None
    region: Region | None = None
    effective_date_from: date | None = None
    effective_date_to: date | None = None
    search: str | None = None
    #: None = no flag filter; True/False = only flagged / only unflagged.
    flagged: bool | None = None

    @property
    def sort_spec(self) -> SortSpec:
        return SortSpec.parse(self.sort)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size

    def cache_key(self, prefix: str, *, include_paging: bool) -> str:
        """Deterministic key covering every field that changes the result set."""
        parts = [
            f"status={self.status}",
            f"lob={self.line_of_business}",
            f"region={self.region}",
            f"from={self.effective_date_from}",
            f"to={self.effective_date_to}",
            f"search={self.search}",
            f"flagged={self.flagged}",
        ]
        if include_paging:
            parts = [f"page={self.page}", f"size={self.size}", f"sort={self.sort}", *parts]
        return f"{prefix}:" + "&".join(parts)


def parse_policy_filter(
    *,
    page: int = 1,
    size: int = 20,
    sort: str | None = None,
    status: str | None = None,
    line_of_business: str | None = None,
    region: str | None = None,
    effective_date_from: date | None = None,
    effective_date_to: date | None = None,
    search: str | None = None,
    flagged: bool | None = None,
) -> PolicyFilter:
    """Validate raw query-string values into a `PolicyFilter`.

    Collects *every* problem before raising, so a request with two bad
    parameters reports both rather than only the first - matching the
    FluentValidation behaviour of the previous implementation.
    """
    errors: dict[str, list[str]] = {}

    def add(field: str, message: str) -> None:
        errors.setdefault(field, []).append(message)

    if page < 1:
        add("page", "page must be greater than or equal to 1.")
    if not 1 <= size <= MAX_PAGE_SIZE:
        add("size", f"size must be between 1 and {MAX_PAGE_SIZE}.")

    if sort:
        try:
            SortSpec.parse(sort)
        except ValueError as exc:
            add("sort", str(exc))

    parsed_status = None
    if status is not None:
        parsed_status = PolicyStatus.try_from_wire(status)
        if parsed_status is None:
            add("status", f"status must be one of: {', '.join(PolicyStatus.wire_values())}.")

    parsed_lob = None
    if line_of_business is not None:
        parsed_lob = LineOfBusiness.try_from_wire(line_of_business)
        if parsed_lob is None:
            add(
                "lineOfBusiness",
                f"lineOfBusiness must be one of: {', '.join(LineOfBusiness.wire_values())}.",
            )

    parsed_region = None
    if region is not None:
        parsed_region = Region.try_from_wire(region)
        if parsed_region is None:
            add("region", f"region must be one of: {', '.join(Region.wire_values())}.")

    if (
        effective_date_from is not None
        and effective_date_to is not None
        and effective_date_from > effective_date_to
    ):
        add("effectiveDateFrom", "effectiveDateFrom must be on or before effectiveDateTo.")

    if search is not None and len(search) > MAX_SEARCH_LENGTH:
        add("search", f"search must not exceed {MAX_SEARCH_LENGTH} characters.")

    if errors:
        raise ValidationError(errors)

    return PolicyFilter(
        page=page,
        size=size,
        sort=sort,
        status=parsed_status,  # type: ignore[arg-type]
        line_of_business=parsed_lob,  # type: ignore[arg-type]
        region=parsed_region,  # type: ignore[arg-type]
        effective_date_from=effective_date_from,
        effective_date_to=effective_date_to,
        search=search.strip() if search else None,
        flagged=flagged,
    )
