"""End-to-end verification sweep against a running API.

Hits every endpoint, asserts the response shape, and checks that caching is
actually doing something (hit counters rise on a repeat, generation bumps and
entries clear after a mutation).

Usage:
    python scripts/verify_api.py [base_url]

Defaults to http://localhost:5080. Pass http://localhost:4200 to exercise the
same path the browser takes, through the Angular dev-server proxy.
"""

from __future__ import annotations

import json
import sys
import time

import httpx

# AI responses can contain characters (em dashes, curly quotes) that Windows'
# default console codepage (cp1252) can't encode, which crashes print() mid-sweep.
sys.stdout.reconfigure(encoding="utf-8")

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5080").rstrip("/")
V1 = f"{BASE}/api/v1"

passed = 0
skipped = 0
failed: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    global passed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed.append(name)
        print(f"  FAIL  {name}" + (f" -- {detail}" if detail else ""))


def skip(name: str, reason: str) -> None:
    global skipped
    skipped += 1
    print(f"  SKIP  {name} -- {reason}")


def is_json(response: httpx.Response) -> bool:
    """The Angular dev-server proxy only forwards /api, so unversioned paths
    come back as the SPA's index.html when the sweep runs against :4200."""
    return response.headers.get("content-type", "").startswith("application/json")


def section(title: str) -> None:
    print(f"\n=== {title} ===")


with httpx.Client(timeout=120) as client:
    # ---------------------------------------------------------------- health
    section("Health")

    response = client.get(f"{BASE}/health")
    if is_json(response):
        check("GET /health -> 200", response.status_code == 200, response.text[:200])
    else:
        skip("GET /health", "not proxied (only /api is forwarded)")

    response = client.get(f"{V1}/health")
    body = response.json()
    check(
        "GET /api/v1/health reports database reachable",
        response.status_code == 200 and body.get("database") == "reachable",
        response.text[:200],
    )

    # --------------------------------------------------------------- policies
    section("Policies")

    response = client.get(f"{V1}/policies")
    listing = response.json()
    check("GET /policies -> 200", response.status_code == 200, response.text[:200])
    check("returns a full first page", len(listing["items"]) == 20, str(len(listing["items"])))
    check("reports a total count", listing["totalCount"] > 0, str(listing["totalCount"]))
    check(
        "computes totalPages",
        listing["totalPages"] == -(-listing["totalCount"] // listing["size"]),
        str(listing["totalPages"]),
    )

    first = listing["items"][0]
    check(
        "fields are camelCase",
        {"policyNumber", "policyholderName", "lineOfBusiness", "flaggedForReview"} <= set(first),
        str(sorted(first)),
    )
    check(
        "premium is a JSON number",
        isinstance(first["premiumAmount"], (int, float)),
        type(first["premiumAmount"]).__name__,
    )

    page_two = client.get(f"{V1}/policies", params={"page": 2, "size": 5}).json()
    page_one = client.get(f"{V1}/policies", params={"page": 1, "size": 5}).json()
    check(
        "paging returns disjoint pages",
        {i["id"] for i in page_one["items"]}.isdisjoint({i["id"] for i in page_two["items"]}),
    )

    filtered = client.get(f"{V1}/policies", params={"region": "Hong Kong", "status": "Active"}).json()
    check(
        "filter by region + status",
        filtered["totalCount"] > 0
        and all(i["region"] == "Hong Kong" and i["status"] == "Active" for i in filtered["items"]),
        str(filtered["totalCount"]),
    )

    ampersand = client.get(f"{V1}/policies", params={"lineOfBusiness": "A&H"}).json()
    check(
        "filter by A&H (ampersand survives the wire)",
        ampersand["totalCount"] > 0 and all(i["lineOfBusiness"] == "A&H" for i in ampersand["items"]),
        str(ampersand["totalCount"]),
    )

    sorted_page = client.get(f"{V1}/policies", params={"sort": "premiumAmount,desc"}).json()
    premiums = [i["premiumAmount"] for i in sorted_page["items"]]
    check("sort by premium desc", premiums == sorted(premiums, reverse=True))

    target = client.get(f"{V1}/policies", params={"size": 1}).json()["items"][0]
    searched = client.get(f"{V1}/policies", params={"search": target["policyNumber"].lower()}).json()
    check(
        "search is case-insensitive",
        target["id"] in {i["id"] for i in searched["items"]},
    )

    by_id = client.get(f"{V1}/policies/{target['id']}")
    check(
        "GET /policies/{id}",
        by_id.status_code == 200 and by_id.json()["policyNumber"] == target["policyNumber"],
        by_id.text[:200],
    )

    missing = client.get(f"{V1}/policies/00000000-0000-0000-0000-000000000000")
    check(
        "unknown id -> 404 with correlationId",
        missing.status_code == 404 and "correlationId" in missing.json(),
        missing.text[:200],
    )

    summary_params = {"region": "Japan"}
    summary = client.get(f"{V1}/policies/summary", params=summary_params).json()
    japan_list = client.get(f"{V1}/policies", params=summary_params).json()
    check(
        "summary total matches the filtered list total",
        summary["totalCount"] == japan_list["totalCount"],
        f'{summary["totalCount"]} vs {japan_list["totalCount"]}',
    )
    check(
        "summary status counts sum to the total",
        sum(summary["countsByStatus"].values()) == summary["totalCount"],
    )

    # ------------------------------------------------------------- validation
    section("Validation")

    bad = client.get(
        f"{V1}/policies", params={"page": 0, "size": 500, "status": "Nope", "region": "Atlantis"}
    )
    errors = bad.json().get("errors", {})
    check("invalid filters -> 400", bad.status_code == 400, bad.text[:200])
    check(
        "every invalid field is reported at once",
        set(errors) == {"page", "size", "status", "region"},
        str(sorted(errors)),
    )

    bad_sort = client.get(f"{V1}/policies", params={"sort": "dropTable,desc"})
    check("unknown sort field -> 400", bad_sort.status_code == 400, bad_sort.text[:200])

    # --------------------------------------------------------------- flagging
    section("Flagging")

    unflagged = client.get(f"{V1}/policies", params={"flagged": "false", "size": 1}).json()["items"][0]
    flag = client.patch(f"{V1}/policies/flag", json={"policyIds": [unflagged["id"]]})
    check(
        "PATCH /policies/flag",
        flag.status_code == 200 and flag.json()["flaggedCount"] == 1,
        flag.text[:200],
    )

    reread = client.get(f"{V1}/policies/{unflagged['id']}").json()
    check("flag is visible on re-read", reread["flaggedForReview"] is True)

    again = client.patch(f"{V1}/policies/flag", json={"policyIds": [unflagged["id"]]})
    check("flagging is idempotent", again.status_code == 200 and again.json()["flaggedCount"] == 1)

    empty = client.patch(f"{V1}/policies/flag", json={"policyIds": []})
    check("empty policyIds -> 400", empty.status_code == 400, empty.text[:200])

    # ---------------------------------------------------------------- caching
    section("Caching")

    client.post(f"{V1}/cache/clear")
    params = {"region": "Australia", "size": 5}

    client.get(f"{V1}/policies", params=params)
    before = client.get(f"{V1}/cache/stats").json()
    client.get(f"{V1}/policies", params=params)
    after = client.get(f"{V1}/cache/stats").json()

    check(
        "repeat query registers a cache hit",
        after["hits"] == before["hits"] + 1,
        f'{before["hits"]} -> {after["hits"]}',
    )
    check("cache holds entries", after["entries"] > 0, str(after["entries"]))

    generation_before = after["generation"]
    next_unflagged = client.get(f"{V1}/policies", params={"flagged": "false", "size": 1}).json()["items"][0]
    client.patch(f"{V1}/policies/flag", json={"policyIds": [next_unflagged["id"]]})
    invalidated = client.get(f"{V1}/cache/stats").json()

    check(
        "mutation bumps the cache generation",
        invalidated["generation"] > generation_before,
        f'{generation_before} -> {invalidated["generation"]}',
    )
    check("mutation clears cached entries", invalidated["entries"] == 0, str(invalidated["entries"]))

    flagged_before = client.get(f"{V1}/policies/summary").json()["flaggedCount"]
    third = client.get(f"{V1}/policies", params={"flagged": "false", "size": 1}).json()["items"][0]
    client.patch(f"{V1}/policies/flag", json={"policyIds": [third["id"]]})
    flagged_after = client.get(f"{V1}/policies/summary").json()["flaggedCount"]
    check(
        "caching never hides a mutation from the summary",
        flagged_after == flagged_before + 1,
        f"{flagged_before} -> {flagged_after}",
    )

    # --------------------------------------------------------------------- AI
    section("AI")

    health = client.get(f"{V1}/ai/health").json()
    print(f"  provider: {health['provider']} / {health['model']} (live={health['liveInference']})")
    check("GET /ai/health", "provider" in health and "model" in health, json.dumps(health)[:200])

    ask = client.post(
        f"{V1}/ai/prompt",
        json={"prompt": "How many policies are flagged?", "scope": {"region": "Singapore"}},
    )
    answer = ask.json()
    check("POST /ai/prompt -> 200", ask.status_code == 200, ask.text[:300])
    check("answer is non-empty", bool(answer.get("answer", "").strip()))
    check("answer echoes its scope", answer["contextSummary"] == "region=Singapore", answer.get("contextSummary", ""))
    check("answer carries usage provenance", answer["usage"]["cached"] is False, json.dumps(answer["usage"]))
    print(f"    -> {answer['answer'][:160].replace(chr(10), ' ')}...")

    repeat = client.post(
        f"{V1}/ai/prompt",
        json={"prompt": "How many policies are flagged?", "scope": {"region": "Singapore"}},
    ).json()
    check(
        "identical prompt is served from cache",
        repeat["usage"]["cached"] is True,
        json.dumps(repeat["usage"]),
    )
    check("cached answer is identical", repeat["answer"] == answer["answer"])

    grounded = client.post(
        f"{V1}/ai/prompt", json={"prompt": "How many policies are in scope?", "scope": {"region": "Japan"}}
    ).json()
    japan_total = client.get(f"{V1}/policies/summary", params={"region": "Japan"}).json()["totalCount"]
    check(
        "answer is grounded in the scoped data",
        str(japan_total) in grounded["answer"],
        f'expected {japan_total} in: {grounded["answer"][:200]}',
    )

    # Policy lookup by number - the reference-resolution path.
    lookup_target = client.get(f"{V1}/policies", params={"size": 1}).json()["items"][0]
    lookup = client.post(
        f"{V1}/ai/prompt",
        json={"prompt": f"Give me the details of policy {lookup_target['policyNumber']}."},
    ).json()
    check(
        "policy can be looked up by number",
        lookup_target["policyholderName"].split()[-1].lower() in lookup["answer"].lower()
        or lookup_target["policyNumber"] in lookup["answer"],
        f'expected {lookup_target["policyNumber"]} / {lookup_target["policyholderName"]} in: '
        f'{lookup["answer"][:250]}',
    )
    print(f"    -> {lookup['answer'][:160].replace(chr(10), ' ')}...")

    # Policy lookup by policyholder name.
    by_name = client.post(
        f"{V1}/ai/prompt",
        json={"prompt": f"What does {lookup_target['policyholderName']} hold?"},
    ).json()
    check(
        "policy can be looked up by policyholder name",
        lookup_target["policyNumber"] in by_name["answer"],
        f'expected {lookup_target["policyNumber"]} in: {by_name["answer"][:250]}',
    )

    empty_prompt = client.post(f"{V1}/ai/prompt", json={"prompt": ""})
    check("empty prompt -> 400", empty_prompt.status_code == 400, empty_prompt.text[:200])

    bad_scope = client.post(f"{V1}/ai/prompt", json={"prompt": "Hi", "scope": {"region": "Atlantis"}})
    check("invalid AI scope -> 400", bad_scope.status_code == 400, bad_scope.text[:200])

    # Streaming
    events: list[dict] = []
    started = time.perf_counter()
    with client.stream(
        "POST",
        f"{V1}/ai/prompt/stream",
        json={"prompt": "In one sentence, summarise this portfolio.", "scope": {"region": "Japan"}},
    ) as response:
        stream_ok = response.status_code == 200 and response.headers.get(
            "content-type", ""
        ).startswith("text/event-stream")
        for line in response.iter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line[6:]))

    tokens = [e for e in events if e["type"] == "token"]
    check("POST /ai/prompt/stream returns an SSE stream", stream_ok)
    check("stream emits tokens", len(tokens) > 0, str(len(events)))
    check("stream terminates with done", events and events[-1]["type"] == "done", str(events[-1:]))
    streamed = "".join(e["value"] for e in tokens)
    check("streamed text is non-empty", bool(streamed.strip()))
    print(f"    -> {len(tokens)} tokens in {int((time.perf_counter() - started) * 1000)} ms")

    # Risk assessment
    risk_target = client.get(f"{V1}/policies", params={"size": 1}).json()["items"][0]
    risk = client.post(f"{V1}/ai/policies/{risk_target['id']}/risk-assessment")
    assessment = risk.json()
    check("POST /ai/policies/{id}/risk-assessment -> 200", risk.status_code == 200, risk.text[:300])
    check(
        "risk score is in range",
        0 <= assessment["riskScore"] <= 100,
        str(assessment.get("riskScore")),
    )
    check("risk band is valid", assessment["riskBand"] in {"Low", "Medium", "High"}, assessment.get("riskBand", ""))
    check("risk factors are present", len(assessment["factors"]) > 0)
    check("assessment names the policy", assessment["policyNumber"] == risk_target["policyNumber"])
    print(f"    -> {assessment['riskBand']} ({assessment['riskScore']}/100): {assessment['summary'][:120]}")

    missing_risk = client.post(
        f"{V1}/ai/policies/00000000-0000-0000-0000-000000000000/risk-assessment"
    )
    check("risk assessment for unknown policy -> 404", missing_risk.status_code == 404)

    # Portfolio brief
    brief_response = client.post(f"{V1}/ai/portfolio-brief", json={"scope": {"flagged": True}})
    brief = brief_response.json()
    check("POST /ai/portfolio-brief -> 200", brief_response.status_code == 200, brief_response.text[:300])
    check("brief is non-empty", bool(brief.get("brief", "").strip()))
    check("brief echoes its scope", brief["contextSummary"] == "flagged only", brief.get("contextSummary", ""))
    print(f"    -> {brief['brief'][:160].replace(chr(10), ' ')}...")

    # ------------------------------------------------------------- operational
    section("Operational")

    stats = client.get(f"{V1}/cache/stats").json()
    check(
        "GET /cache/stats reports counters",
        {"hits", "misses", "hitRate", "entries", "generation"} <= set(stats),
        str(sorted(stats)),
    )
    print(f"  cache: {stats['hits']} hits / {stats['misses']} misses (rate {stats['hitRate']})")

    cleared = client.post(f"{V1}/cache/clear").json()
    check("POST /cache/clear empties the cache", cleared["entries"] == 0, str(cleared["entries"]))

    openapi = client.get(f"{BASE}/openapi.json")
    if is_json(openapi):
        document = openapi.json()
        check(
            "every documented path is versioned",
            all(path.startswith(("/api/v1", "/health")) for path in document["paths"]),
            str([p for p in document["paths"] if not p.startswith(("/api/v1", "/health"))]),
        )
        print(f"  openapi documents {len(document['paths'])} paths")
    else:
        skip("GET /openapi.json", "not proxied (only /api is forwarded)")

print(f"\n{'=' * 60}")
print(f"{passed} passed, {len(failed)} failed, {skipped} skipped  (against {BASE})")
if failed:
    for name in failed:
        print(f"  FAILED: {name}")
    sys.exit(1)
print("ALL CHECKS PASSED")
