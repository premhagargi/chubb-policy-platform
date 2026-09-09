"""Unit tests for the layers that hold the interesting logic: domain
invariants, filter parsing, the cache, and the AI response parser."""

from __future__ import annotations

import time
from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.application.ai_service import _cache_key, _parse_risk_json
from app.application.dto import PagedResult, PolicyDto
from app.application.filters import PolicyFilter, SortSpec, parse_policy_filter
from app.core.cache import InMemoryCache
from app.core.errors import LlmProviderError, ValidationError
from app.domain.enums import LineOfBusiness, PolicyStatus, Region, currency_for_region
from app.domain.policy import Policy


# --------------------------------------------------------------------------- #
# Domain
# --------------------------------------------------------------------------- #


def _policy(**overrides) -> Policy:
    defaults = dict(
        policy_number="PCL-000001",
        policyholder_name="Acme Pte Ltd",
        line_of_business=LineOfBusiness.PROPERTY,
        status=PolicyStatus.ACTIVE,
        premium_amount=Decimal("25000.00"),
        currency=currency_for_region(Region.SINGAPORE),
        effective_date=date(2026, 1, 1),
        expiry_date=date(2027, 1, 1),
        region=Region.SINGAPORE,
        underwriter="J. Tan",
    )
    return Policy.create(**{**defaults, **overrides})


def test_premium_below_floor_is_rejected():
    with pytest.raises(ValueError, match="Premium amount"):
        _policy(premium_amount=Decimal("999"))


def test_premium_above_ceiling_is_rejected():
    with pytest.raises(ValueError, match="Premium amount"):
        _policy(premium_amount=Decimal("5000001"))


def test_expiry_must_follow_effective_date():
    with pytest.raises(ValueError, match="after the effective date"):
        _policy(effective_date=date(2026, 6, 1), expiry_date=date(2026, 6, 1))


def test_flag_sets_review_and_touches_updated_at():
    policy = _policy()
    original = policy.updated_at

    time.sleep(0.001)
    policy.flag()

    assert policy.flagged_for_review is True
    assert policy.updated_at > original


def test_expiring_soon_window():
    today = date(2026, 6, 1)
    policy = _policy(effective_date=date(2026, 1, 1), expiry_date=today + timedelta(days=10))

    assert policy.is_expiring_soon(today) is True
    assert policy.is_expiring_soon(today + timedelta(days=30)) is False


def test_cancelled_policy_is_never_expiring_soon():
    """Only Active policies count toward the renewal metric."""
    today = date(2026, 6, 1)
    policy = _policy(status=PolicyStatus.CANCELLED, expiry_date=today + timedelta(days=5))

    assert policy.is_expiring_soon(today) is False


def test_wire_enums_round_trip_non_identifier_values():
    assert LineOfBusiness.from_wire("A&H") is LineOfBusiness.ACCIDENT_AND_HEALTH
    assert LineOfBusiness.ACCIDENT_AND_HEALTH.value == "A&H"
    assert Region.from_wire("hong kong") is Region.HONG_KONG
    assert Region.HONG_KONG.value == "Hong Kong"


# --------------------------------------------------------------------------- #
# Filters and sorting
# --------------------------------------------------------------------------- #


def test_sort_defaults_to_created_at_desc():
    assert SortSpec.parse(None) == SortSpec(column="created_at", descending=True)
    assert SortSpec.parse("  ") == SortSpec(column="created_at", descending=True)


def test_sort_parses_field_and_direction():
    assert SortSpec.parse("premiumAmount,desc") == SortSpec("premium_amount", True)
    assert SortSpec.parse("policyNumber,asc") == SortSpec("policy_number", False)
    assert SortSpec.parse("policyNumber") == SortSpec("policy_number", False)


def test_unknown_sort_field_is_rejected():
    """An unknown field must not silently fall back - that would hide a client bug."""
    with pytest.raises(ValueError, match="sort must reference"):
        SortSpec.parse("dropTable,desc")


def test_filter_reports_every_problem_at_once():
    with pytest.raises(ValidationError) as exc_info:
        parse_policy_filter(page=0, size=500, status="Nonsense", region="Atlantis")

    errors = exc_info.value.errors
    assert set(errors) == {"page", "size", "status", "region"}


def test_filter_rejects_inverted_date_range():
    with pytest.raises(ValidationError) as exc_info:
        parse_policy_filter(
            effective_date_from=date(2026, 6, 1), effective_date_to=date(2026, 1, 1)
        )

    assert "effectiveDateFrom" in exc_info.value.errors


def test_cache_key_distinguishes_paging_but_summary_ignores_it():
    page_one = PolicyFilter(page=1, size=20, region=Region.JAPAN)
    page_two = PolicyFilter(page=2, size=20, region=Region.JAPAN)

    assert page_one.cache_key("policies", include_paging=True) != page_two.cache_key(
        "policies", include_paging=True
    )
    assert page_one.cache_key("summary", include_paging=False) == page_two.cache_key(
        "summary", include_paging=False
    )


def test_paged_result_computes_total_pages():
    result = PagedResult[PolicyDto](items=[], page=1, size=20, total_count=41)
    assert result.total_pages == 3

    assert PagedResult[PolicyDto](items=[], page=1, size=20, total_count=0).total_pages == 0


# --------------------------------------------------------------------------- #
# Cache
# --------------------------------------------------------------------------- #


def test_cache_hit_and_miss_counters():
    cache = InMemoryCache()

    assert cache.get("k") is None
    cache.set("k", "v", ttl_seconds=60)
    assert cache.get("k") == "v"

    stats = cache.stats()
    assert (stats.hits, stats.misses) == (1, 1)
    assert stats.hit_rate == 0.5


def test_expired_entry_is_a_miss():
    cache = InMemoryCache()
    cache.set("k", "v", ttl_seconds=-1)

    assert cache.get("k") is None


def test_invalidate_all_bumps_generation_and_evicts():
    cache = InMemoryCache()
    cache.set("k", "v", ttl_seconds=60)

    cache.invalidate_all()

    assert cache.get("k") is None
    assert cache.stats().generation == 1


def test_cache_evicts_oldest_entry_when_full():
    cache = InMemoryCache(max_entries=2)
    cache.set("a", 1, 60)
    cache.set("b", 2, 60)
    cache.set("c", 3, 60)

    assert cache.get("a") is None  # oldest, evicted
    assert cache.get("c") == 3
    assert cache.stats().evictions == 1


@pytest.mark.asyncio
async def test_aget_or_set_reports_hit_on_second_call():
    cache = InMemoryCache()
    calls = 0

    async def factory() -> str:
        nonlocal calls
        calls += 1
        return "value"

    first, first_hit = await cache.aget_or_set("k", factory, 60)
    second, second_hit = await cache.aget_or_set("k", factory, 60)

    assert (first, second) == ("value", "value")
    assert first_hit is False and second_hit is True
    assert calls == 1


# --------------------------------------------------------------------------- #
# AI response parsing
# --------------------------------------------------------------------------- #


def _dto(**overrides) -> PolicyDto:
    defaults = dict(
        id="11111111-1111-1111-1111-111111111111",
        policy_number="PCL-000001",
        policyholder_name="Acme",
        line_of_business="Property",
        status="Active",
        premium_amount=Decimal("1000"),
        currency="SGD",
        effective_date=date(2026, 1, 1),
        expiry_date=date(2027, 1, 1),
        region="Singapore",
        underwriter="J. Tan",
        flagged_for_review=False,
        created_at="2026-01-01T00:00:00Z",
        updated_at="2026-01-01T00:00:00Z",
    )
    return PolicyDto(**{**defaults, **overrides})


def test_risk_json_is_extracted_from_surrounding_prose():
    """Models add preamble or a code fence despite instructions; the parser must
    still find the object rather than 500."""
    raw = 'Sure!\n```json\n{"riskScore": 80, "riskBand": "High", "factors": ["a"], "suggestFlag": true}\n```'

    parsed = _parse_risk_json(raw, _dto())

    assert parsed["risk_score"] == 80
    assert parsed["risk_band"] == "High"
    assert parsed["suggest_flag"] is True


def test_risk_band_is_derived_when_model_returns_a_bad_one():
    raw = '{"riskScore": 50, "riskBand": "Catastrophic", "factors": []}'

    parsed = _parse_risk_json(raw, _dto())

    assert parsed["risk_band"] == "Medium"
    assert parsed["factors"], "a placeholder factor should be supplied"


def test_risk_score_is_clamped_to_range():
    parsed = _parse_risk_json('{"riskScore": 900, "riskBand": "High"}', _dto())
    assert parsed["risk_score"] == 100

    parsed = _parse_risk_json('{"riskScore": -5, "riskBand": "Low"}', _dto())
    assert parsed["risk_score"] == 0


def test_suggest_flag_is_suppressed_for_already_flagged_policy():
    raw = '{"riskScore": 90, "riskBand": "High", "suggestFlag": true}'

    parsed = _parse_risk_json(raw, _dto(flagged_for_review=True))

    assert parsed["suggest_flag"] is False


def test_non_json_risk_response_raises_provider_error():
    with pytest.raises(LlmProviderError):
        _parse_risk_json("I cannot assess this policy.", _dto())


def test_ai_cache_key_changes_with_model():
    a = _cache_key("risk", "model-a", "sys", "user")
    b = _cache_key("risk", "model-b", "sys", "user")

    assert a != b
