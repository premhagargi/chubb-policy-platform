---
name: add-endpoint
description: Add a new REST or AI endpoint to the FastAPI backend following the project's layering, caching and contract rules. Use when adding, changing, or removing an API route, DTO, filter or AI feature.
---

# Add an endpoint

The layering here is the point of the exercise, so an endpoint that works but skips a
layer is a defect. Work outward from the domain, not inward from the route.

## The rule

```
api → application → domain
infrastructure → application → domain
```

`domain/` and `application/` must not import SQLAlchemy, FastAPI or any vendor SDK.
Ports are structural `Protocol`s, so implementations do **not** import them.

## Order of work

### 1. Domain (`app/domain/`) — only if a new concept or invariant appears

Invariants live on the aggregate, never in the route handler. If a new state transition
is involved, add a method to `Policy` rather than mutating fields from a service.

### 2. Application (`app/application/`)

- **DTOs** in `dto.py`, subclassing `CamelModel` so the wire stays camelCase.
  Money fields use the `Money` alias — plain `Decimal` serialises as a JSON *string* and
  breaks arithmetic in the UI.
- **New filter fields** go in `filters.py`: add to `PolicyFilter`, validate inside
  `parse_policy_filter` (accumulate into `errors`, never raise early), and add to
  `cache_key` — a filter missing from the key returns another filter's cached results.
- **New behaviour** gets a method on the relevant port in `ports.py`.

### 3. Infrastructure (`app/infrastructure/`)

- Implement the port. Push filtering, sorting and aggregation into SQL; never
  materialise the table into Python.
- Reuse `_apply_filters` so list and summary always describe the same set.
- If the port is `PolicyQueryService`, mirror the method in
  `CachedPolicyQueryService` — a method added to the SQL class but not the decorator
  silently bypasses the cache.

### 4. API (`app/api/v1/`)

- Add the route to the relevant router. Everything hangs off `/api/v1` via `router.py`;
  never mount a route outside it.
- Depend on the **port**, injected through `deps.py`. Never construct a repository or
  session in a handler.
- Declare `response_model`, a `summary`, and the non-200 responses you can produce.
- **Route order matters**: a literal path (`/policies/summary`) must be declared before
  a parameterised one (`/policies/{policy_id}`), or the literal is swallowed.

## Caching

Reads that are worth caching go through the decorator, not through branching in the
query code.

**Any new mutation must invalidate the cache** — follow
`CacheInvalidatingPolicyCommandService`. A mutation that does not invalidate will serve
stale reads for the whole TTL, which is the exact bug the generation counter exists to
prevent. Prove it with a test that mutates and then re-reads.

## AI endpoints

- Prompt text goes in `application/prompts.py`. Never inline a prompt at a call site.
- Ground the answer: read live data through the query port, the same way `AiService`
  does, so the model and the dashboard cannot disagree.
- Return a `usage` block (provider, model, latency, cached) so the UI can show
  provenance.
- Parse model output **defensively**. A model will wrap JSON in a code fence or add a
  sentence despite instructions; see `_parse_risk_json`, which extracts the first
  `{...}` block and range-checks every field rather than trusting it.
- Streaming endpoints report mid-stream failures as an SSE `error` event — the status
  line is already sent by then, so an exception cannot become a 500.

## Contract and tests

```bash
cd backend
.venv/Scripts/python scripts/export_openapi.py   # regenerate openapi.yaml - it is generated, not hand-edited
.venv/Scripts/python -m pytest
```

Add tests in `tests/test_api.py` (behaviour through the real ASGI app) and
`tests/test_unit.py` (logic). Tests must not hit the network — the fixtures use the mock
LLM provider.

Then add a check to `scripts/verify_api.py` and run the `verify-stack` skill. An endpoint
that is not in the sweep is not covered by the thing that actually proves the system
works.

## Frontend

If the UI consumes it: add the model to `src/app/core/models/`, the call to the
appropriate service in `src/app/core/services/`, and keep state in
`PolicyStateService` — components read signals and call intent methods rather than
issuing their own requests.

## Related

- `CLAUDE.md` — conventions and Angular 18 gotchas
- `.claude/skills/verify-stack/SKILL.md` — how to prove it works
