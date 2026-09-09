# CLAUDE.md

Project context for Claude Code. Read this before changing anything.

## What this is

A policy management POC for Chubb APAC: **Python/FastAPI** backend + **Angular 18**
dashboard, with in-memory caching and **Cerebras**-backed AI features.

The requirements are fixed by the POC brief and are not up for reinterpretation:
Python/FastAPI backend, in-memory caching, Angular 18, all REST endpoints under
`/api/v1`, an integrated LLM provider, and a working end-to-end prompt flow. If a change
would break one of these, say so rather than doing it.

A previous .NET 8 backend was replaced wholesale. Do not reintroduce C#.

## Commands

```bash
# Backend (from backend/)
.venv/Scripts/python -m uvicorn app.main:app --reload --port 5080   # run
.venv/Scripts/python -m pytest                                      # 69 tests
.venv/Scripts/python scripts/verify_api.py                          # live end-to-end sweep
.venv/Scripts/python scripts/export_openapi.py                      # regenerate openapi.yaml

# Frontend (from frontend/chubb-policy-ui/)
npm start                                    # dev server on :4200, proxies /api to :5080
npm test                                     # Karma/Jasmine
npx ng build                                 # production build
```

On Linux/macOS use `.venv/bin/python`.

## Layering — the rule that matters

```
api → application → domain
infrastructure → application → domain
```

`domain/` and `application/` must never import SQLAlchemy, FastAPI or any vendor SDK.
Ports in `application/ports.py` are structural `Protocol`s, so implementations in
`infrastructure/` do **not** import them — the arrow points one way only.

`api/deps.py` is the composition root: the single place that knows which concrete class
satisfies which port. Adding or removing the caching decorator is a one-line change
there, and no endpoint should ever need editing for it.

## Conventions

- **Wire format is camelCase.** DTOs subclass `CamelModel` (`application/dto.py`). The
  Angular client is written against this; snake_case on the wire is a breaking change.
- **Money crosses the wire as a JSON number.** `Money` in `dto.py` exists because
  pydantic renders `Decimal` as a *string* by default, which silently breaks arithmetic
  in the UI. Do not "simplify" it back to plain `Decimal`.
- **Validation collects every error.** `parse_policy_filter` raises once with all
  problems. Do not move bounds into `Query(ge=..., le=...)` — FastAPI stops at the first
  failure.
- **Enums carry their wire value.** `"A&H"` and `"Hong Kong"` are not valid identifiers,
  so `WireEnum.value` is the single source for both DB and JSON. Never use `.name` or
  `str()` to build a wire value.
- **Errors** use the `ErrorResponse` shape with a `correlationId`; validation is 400,
  not FastAPI's default 422.
- **Every route lives under `/api/v1`** via `api/v1/router.py`.

## Caching

`core/cache.py` — TTL entries plus a **generation** counter, so one `invalidate_all()`
after a mutation evicts everything. Applied by composition
(`CachedPolicyQueryService`), never by branching inside query code.

Any new mutation **must** invalidate the cache, or reads will serve stale data. Follow
`CacheInvalidatingPolicyCommandService`.

`GET /api/v1/cache/stats` exposes hits/misses/entries/generation — use it to prove cache
behaviour rather than asserting it.

## AI

Three features over one `LlmProvider` port: Policy Copilot (`/ai/prompt`, plus an SSE
stream), per-policy risk assessment, portfolio brief. Only the first two are surfaced in
the UI — the brief endpoint is live and tested but has no card since the dashboard one
was removed. Do not delete it; it is part of the documented contract.

- **All prompt text lives in `application/prompts.py`.** Do not inline prompts at call
  sites.
- **Answers must be grounded.** `AiService` reads live data through the same cached
  query service the REST endpoints use, so the model and the dashboard cannot disagree.
  Never let the model answer from memory.
- **`references.py`** resolves policy numbers and names in a question to real records.
  If single-policy questions stop working, look there first.
- **Never commit an API key.** `backend/.env` is git-ignored; `.env.example` documents
  the variables.
- **Tests must not call the network.** The mock provider is used throughout the suite,
  selected via `LLM_PROVIDER=mock` in the test settings.

Model output is **untrusted text**. It is rendered through Angular bindings
(`markdown-text.component.ts`), never `innerHTML`. Do not swap in a Markdown library
that emits HTML.

## Frontend

Angular 18, standalone components, signals for state (no NgRx), Tailwind 4 via
`.postcssrc.json`, Manrope as the only font (one `--font-sans` token).

Angular 18 specifics that bite:

- `standalone: true` is **required** on every component (it only became the default in
  v19).
- `@else if` does **not** support the `as` alias that `@if` does. Nest instead of
  chaining; the compiler error points at the block body, not the alias.
- Backticks inside a component template are a TS template-literal terminator. Never put
  them in template comments.
- `zone.js` is required in polyfills; the app is not zoneless.
- **Writing a signal inside `effect()` throws NG0600** unless you pass
  `{ allowSignalWrites: true }`. This became the default (and the option was removed) in
  v19, so any snippet written for a newer Angular will compile here and then fail at
  runtime. It is not a build error — the effect just throws and the feature silently does
  nothing. This exact bug left every page empty until the user pressed Refresh; see
  `policy-state.service.spec.ts`, which covers it.

`PolicyStateService` owns all list state; components read signals and call intent
methods. No component issues its own HTTP request except the AI components, which own
their own request lifecycle.

## Before you say it works

Run `backend/scripts/verify_api.py` against a running stack. Unit tests use the mock
provider and prove nothing about the live Cerebras integration. The sweep checks every
endpoint, that repeat queries register cache hits, and that a mutation invalidates the
cache.

Report failures with the actual output. Do not describe unrun commands as passing.
