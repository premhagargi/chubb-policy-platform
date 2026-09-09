"""End-to-end API tests through the real ASGI app."""

from __future__ import annotations

import json

import pytest

pytestmark = pytest.mark.asyncio

V1 = "/api/v1"


# --------------------------------------------------------------------------- #
# Policies
# --------------------------------------------------------------------------- #


async def test_list_returns_first_page_by_default(client):
    response = await client.get(f"{V1}/policies")

    assert response.status_code == 200
    body = response.json()
    assert body["page"] == 1
    assert body["size"] == 20
    assert len(body["items"]) == 20
    assert body["totalCount"] > 20
    assert body["totalPages"] == -(-body["totalCount"] // 20)


async def test_response_is_camel_case(client):
    """The Angular client is generated from this contract; snake_case here is a
    breaking change."""
    item = (await client.get(f"{V1}/policies", params={"size": 1})).json()["items"][0]

    assert {"policyNumber", "policyholderName", "lineOfBusiness", "flaggedForReview"} <= set(item)
    assert "policy_number" not in item


async def test_premium_is_a_json_number_not_a_string(client):
    """pydantic renders Decimal as a string by default - that would break every
    numeric format and sum in the UI."""
    raw = (await client.get(f"{V1}/policies", params={"size": 1})).text
    premium = json.loads(raw)["items"][0]["premiumAmount"]

    assert isinstance(premium, (int, float))


async def test_paging_returns_disjoint_pages(client):
    first = (await client.get(f"{V1}/policies", params={"page": 1, "size": 5})).json()
    second = (await client.get(f"{V1}/policies", params={"page": 2, "size": 5})).json()

    assert {i["id"] for i in first["items"]}.isdisjoint({i["id"] for i in second["items"]})


async def test_filter_by_region_and_status(client):
    response = await client.get(f"{V1}/policies", params={"region": "Hong Kong", "status": "Active"})

    body = response.json()
    assert body["totalCount"] > 0
    assert all(i["region"] == "Hong Kong" and i["status"] == "Active" for i in body["items"])


async def test_filter_by_line_of_business_with_ampersand(client):
    response = await client.get(f"{V1}/policies", params={"lineOfBusiness": "A&H"})

    body = response.json()
    assert body["totalCount"] > 0
    assert all(i["lineOfBusiness"] == "A&H" for i in body["items"])


async def test_sort_descending_by_premium(client):
    body = (await client.get(f"{V1}/policies", params={"sort": "premiumAmount,desc"})).json()
    premiums = [i["premiumAmount"] for i in body["items"]]

    assert premiums == sorted(premiums, reverse=True)


async def test_search_matches_policy_number_case_insensitively(client):
    target = (await client.get(f"{V1}/policies", params={"size": 1})).json()["items"][0]

    body = (await client.get(f"{V1}/policies", params={"search": target["policyNumber"].lower()})).json()

    assert target["id"] in {i["id"] for i in body["items"]}


async def test_get_by_id(client):
    target = (await client.get(f"{V1}/policies", params={"size": 1})).json()["items"][0]

    response = await client.get(f"{V1}/policies/{target['id']}")

    assert response.status_code == 200
    assert response.json()["policyNumber"] == target["policyNumber"]


async def test_get_by_unknown_id_returns_404_problem_shape(client):
    response = await client.get(f"{V1}/policies/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404
    body = response.json()
    assert body["status"] == 404
    assert "correlationId" in body


async def test_malformed_uuid_is_a_400(client):
    response = await client.get(f"{V1}/policies/not-a-uuid")

    assert response.status_code == 400
    assert "policy_id" in response.json()["errors"]


async def test_summary_matches_the_filtered_list_total(client):
    params = {"region": "Japan"}
    listing = (await client.get(f"{V1}/policies", params=params)).json()
    summary = (await client.get(f"{V1}/policies/summary", params=params)).json()

    assert summary["totalCount"] == listing["totalCount"]
    assert sum(summary["countsByStatus"].values()) == summary["totalCount"]
    assert set(summary["countsByRegion"]) == {"Japan"}


# --------------------------------------------------------------------------- #
# Validation
# --------------------------------------------------------------------------- #


async def test_invalid_filters_report_every_problem_at_once(client):
    response = await client.get(
        f"{V1}/policies", params={"page": 0, "size": 500, "status": "Nope", "region": "Atlantis"}
    )

    assert response.status_code == 400
    errors = response.json()["errors"]
    assert set(errors) == {"page", "size", "status", "region"}


async def test_unknown_sort_field_is_rejected(client):
    response = await client.get(f"{V1}/policies", params={"sort": "dropTable,desc"})

    assert response.status_code == 400
    assert "sort" in response.json()["errors"]


# --------------------------------------------------------------------------- #
# Flagging
# --------------------------------------------------------------------------- #


async def test_flag_marks_policies_and_is_visible_on_reread(client):
    target = (await client.get(f"{V1}/policies", params={"flagged": "false", "size": 1})).json()["items"][0]

    response = await client.patch(f"{V1}/policies/flag", json={"policyIds": [target["id"]]})

    assert response.status_code == 200
    assert response.json() == {"flaggedPolicyIds": [target["id"]], "flaggedCount": 1}

    reread = (await client.get(f"{V1}/policies/{target['id']}")).json()
    assert reread["flaggedForReview"] is True


async def test_flag_is_idempotent(client):
    target = (await client.get(f"{V1}/policies", params={"flagged": "false", "size": 1})).json()["items"][0]

    await client.patch(f"{V1}/policies/flag", json={"policyIds": [target["id"]]})
    second = await client.patch(f"{V1}/policies/flag", json={"policyIds": [target["id"]]})

    assert second.status_code == 200
    assert second.json()["flaggedCount"] == 1


async def test_flag_with_empty_list_is_rejected(client):
    response = await client.patch(f"{V1}/policies/flag", json={"policyIds": []})

    assert response.status_code == 400


async def test_flag_with_unknown_id_reports_nothing_flagged(client):
    response = await client.patch(
        f"{V1}/policies/flag", json={"policyIds": ["00000000-0000-0000-0000-000000000000"]}
    )

    assert response.status_code == 200
    assert response.json()["flaggedCount"] == 0


# --------------------------------------------------------------------------- #
# Caching
# --------------------------------------------------------------------------- #


async def test_repeat_query_is_served_from_cache(client):
    params = {"region": "Australia", "size": 5}

    await client.get(f"{V1}/policies", params=params)
    before = (await client.get(f"{V1}/cache/stats")).json()["hits"]
    await client.get(f"{V1}/policies", params=params)
    after = (await client.get(f"{V1}/cache/stats")).json()["hits"]

    assert after == before + 1


async def test_flagging_invalidates_the_cache(client):
    await client.get(f"{V1}/policies", params={"region": "Australia"})
    assert (await client.get(f"{V1}/cache/stats")).json()["entries"] > 0

    target = (await client.get(f"{V1}/policies", params={"flagged": "false", "size": 1})).json()["items"][0]
    await client.patch(f"{V1}/policies/flag", json={"policyIds": [target["id"]]})

    stats = (await client.get(f"{V1}/cache/stats")).json()
    assert stats["entries"] == 0
    assert stats["generation"] == 1


async def test_summary_reflects_a_flag_immediately_despite_caching(client):
    """The cache must never make a mutation look like it did not happen."""
    before = (await client.get(f"{V1}/policies/summary")).json()["flaggedCount"]

    target = (await client.get(f"{V1}/policies", params={"flagged": "false", "size": 1})).json()["items"][0]
    await client.patch(f"{V1}/policies/flag", json={"policyIds": [target["id"]]})

    after = (await client.get(f"{V1}/policies/summary")).json()["flaggedCount"]
    assert after == before + 1


async def test_cache_clear_endpoint_empties_the_cache(client):
    await client.get(f"{V1}/policies")
    assert (await client.get(f"{V1}/cache/stats")).json()["entries"] > 0

    await client.post(f"{V1}/cache/clear")

    assert (await client.get(f"{V1}/cache/stats")).json()["entries"] == 0


# --------------------------------------------------------------------------- #
# AI
# --------------------------------------------------------------------------- #


async def test_ai_health_reports_the_mock_in_tests(client):
    body = (await client.get(f"{V1}/ai/health")).json()

    assert body["provider"] == "mock"
    assert body["liveInference"] is False


async def test_prompt_answers_with_provenance(client):
    response = await client.post(
        f"{V1}/ai/prompt",
        json={"prompt": "How many policies are flagged?", "scope": {"region": "Singapore"}},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["answer"]
    assert body["contextSummary"] == "region=Singapore"
    assert body["usage"]["provider"] == "mock"
    assert body["usage"]["cached"] is False


async def test_repeat_prompt_is_served_from_cache(client):
    payload = {"prompt": "Summarise this book.", "scope": {"region": "Japan"}}

    first = (await client.post(f"{V1}/ai/prompt", json=payload)).json()
    second = (await client.post(f"{V1}/ai/prompt", json=payload)).json()

    assert first["usage"]["cached"] is False
    assert second["usage"]["cached"] is True
    assert second["answer"] == first["answer"]


async def test_prompt_grounding_reflects_the_requested_scope(client):
    """A scoped question must not be answered from the whole book."""
    summary = (await client.get(f"{V1}/policies/summary", params={"region": "Japan"})).json()

    body = (
        await client.post(
            f"{V1}/ai/prompt",
            json={"prompt": "How many policies?", "scope": {"region": "Japan"}},
        )
    ).json()

    assert str(summary["totalCount"]) in body["answer"]


async def test_empty_prompt_is_rejected(client):
    response = await client.post(f"{V1}/ai/prompt", json={"prompt": ""})

    assert response.status_code == 400


async def test_overlong_prompt_is_rejected(client):
    response = await client.post(f"{V1}/ai/prompt", json={"prompt": "x" * 5000})

    assert response.status_code == 400


async def test_invalid_scope_is_rejected_like_a_rest_filter(client):
    response = await client.post(
        f"{V1}/ai/prompt", json={"prompt": "Hello", "scope": {"region": "Atlantis"}}
    )

    assert response.status_code == 400
    assert "region" in response.json()["errors"]


async def test_prompt_stream_emits_tokens_then_done(client):
    events = []
    async with client.stream(
        "POST", f"{V1}/ai/prompt/stream", json={"prompt": "Give me a one line summary."}
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")

        async for line in response.aiter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line[6:]))

    assert events[-1]["type"] == "done"
    assert any(e["type"] == "token" for e in events)
    assert "".join(e["value"] for e in events if e["type"] == "token").strip()


async def test_risk_assessment_returns_structured_result(client):
    target = (await client.get(f"{V1}/policies", params={"size": 1})).json()["items"][0]

    response = await client.post(f"{V1}/ai/policies/{target['id']}/risk-assessment")

    assert response.status_code == 200
    body = response.json()
    assert 0 <= body["riskScore"] <= 100
    assert body["riskBand"] in {"Low", "Medium", "High"}
    assert body["factors"]
    assert body["policyNumber"] == target["policyNumber"]


async def test_risk_assessment_for_unknown_policy_is_404(client):
    response = await client.post(
        f"{V1}/ai/policies/00000000-0000-0000-0000-000000000000/risk-assessment"
    )

    assert response.status_code == 404


async def test_portfolio_brief_is_generated(client):
    response = await client.post(f"{V1}/ai/portfolio-brief", json={"scope": {"flagged": True}})

    assert response.status_code == 200
    body = response.json()
    assert body["brief"]
    assert body["contextSummary"] == "flagged only"


# --------------------------------------------------------------------------- #
# System
# --------------------------------------------------------------------------- #


async def test_health_checks_the_database(client):
    response = await client.get(f"{V1}/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "database": "reachable"}


async def test_openapi_document_is_served_and_versioned(client):
    document = (await client.get("/openapi.json")).json()

    assert all(path.startswith(("/api/v1", "/health")) for path in document["paths"])
