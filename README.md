# Chubb APAC Policy Management Platform

A policy management POC: a **Python / FastAPI** backend with in-memory caching and
**Cerebras**-backed AI features, behind an **Angular 18** operations dashboard.

## POC requirements

| # | Requirement | Where |
|---|---|---|
| 1 | Backend REST APIs in Python + FastAPI | `backend/app` |
| 2 | In-memory caching mechanism | `backend/app/core/cache.py`, `backend/app/infrastructure/caching/` |
| 3 | Frontend in Angular 18 | `frontend/chubb-policy-ui` |
| 4 | Frontend routing, integrated with the backend APIs | `src/app/app.routes.ts`, `src/app/core/services/` |
| 5 | All REST endpoints versioned under `/api/v1` | `backend/app/api/v1/router.py` |
| 6 | An LLM provider integrated | Cerebras (`backend/app/infrastructure/llm/`), with a mock fallback |
| 7 | Complete prompt flow, end to end | Angular assistant → `POST /api/v1/ai/prompt/stream` → Cerebras → streamed back into the UI |

## Quick start

```bash
# 1. Backend
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements-dev.txt      # Linux/macOS: .venv/bin/pip
.venv/Scripts/python -m uvicorn app.main:app --reload --port 5080

# 2. Frontend (separate terminal)
cd frontend/chubb-policy-ui
npm install
npm start
```

- Frontend: http://localhost:4200
- API: http://localhost:5080 — Swagger UI at `/docs`, ReDoc at `/redoc`
- Health: `/health` (liveness) and `/api/v1/health` (also checks the database)

The database is created and seeded on first boot with 220 deterministic policy records
(`backend/app/infrastructure/db/seed.py`). SQLite by default, so there is nothing to
install; point `DATABASE_URL` at Postgres to switch.

## Configuration

Copy `.env.example` to `backend/.env` and fill in what you need — every value has a
working default except the Cerebras key.

| Variable | Default | Purpose |
|---|---|---|
| `CEREBRAS_API_KEY` | *(unset)* | Enables live inference. Without it the app runs on the mock provider. |
| `CEREBRAS_MODEL` | `gpt-oss-120b` | Any model your key can access (`GET /api/v1/ai/health` reports what is in use). |
| `LLM_PROVIDER` | `auto` | `auto` \| `cerebras` \| `mock`. `auto` uses Cerebras when a key is present. |
| `LLM_MAX_TOKENS` | `4000` | Reasoning models spend part of this budget before emitting any content. |
| `DATABASE_URL` | `sqlite+aiosqlite:///./chubb_policies.db` | Use `postgresql+asyncpg://…` for Postgres. |
| `CACHE_LIST_TTL_SECONDS` | `30` | List-response TTL. |
| `CACHE_SUMMARY_TTL_SECONDS` | `60` | Summary-response TTL. |
| `CACHE_LLM_TTL_SECONDS` | `300` | AI-answer TTL. |

**No API key?** Everything still works. The factory falls back to a deterministic mock
provider, and `GET /api/v1/ai/health` says so.

## AI features

All three run through one swappable `LlmProvider` port and share the in-memory cache.

1. **Policy Copilot** — the end-to-end prompt flow. The right-hand assistant panel sends
   the question *plus the filter currently on screen*, so answers describe the set the
   user is looking at rather than the whole book. Answers stream token by token over
   SSE. It handles three question types: single-policy lookups (by policy number or
   policyholder name), summaries, and statistics.
2. **AI risk assessment** — per-policy underwriting triage in the detail drawer,
   returning a structured score, band, factors and recommendation. When the model judges
   a policy worth flagging, the panel offers the existing flag action, so the AI output
   ends in a real state change rather than a paragraph.
3. **Portfolio brief** — a three-bullet executive narrative over the current dashboard
   KPIs.

Every AI response carries a `usage` block (provider, model, latency, cache hit), shown
in the UI so you can see where an answer came from.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/policies` | Filter, search, sort, page the register |
| GET | `/api/v1/policies/summary` | Aggregations over the same filtered set |
| GET | `/api/v1/policies/{id}` | One policy |
| PATCH | `/api/v1/policies/flag` | Flag policies for review |
| GET | `/api/v1/ai/health` | Which provider and model are answering |
| POST | `/api/v1/ai/prompt` | Ask the Copilot (cached) |
| POST | `/api/v1/ai/prompt/stream` | Ask the Copilot, streamed (SSE) |
| POST | `/api/v1/ai/policies/{id}/risk-assessment` | Structured per-policy risk triage |
| POST | `/api/v1/ai/portfolio-brief` | Executive brief over the current filter |
| GET | `/api/v1/cache/stats` | Cache hits, misses, entries, generation |
| POST | `/api/v1/cache/clear` | Evict everything (for demos) |
| GET | `/api/v1/health` | Liveness + database reachability |

## Testing

```bash
# Backend: 69 tests, no network calls (the mock provider is used throughout)
cd backend && .venv/Scripts/python -m pytest

# Frontend
cd frontend/chubb-policy-ui && npm test

# End-to-end sweep against a running stack - every endpoint, plus cache behaviour
cd backend && .venv/Scripts/python scripts/verify_api.py
.venv/Scripts/python scripts/verify_api.py http://localhost:4200   # via the Angular proxy
```

`scripts/verify_api.py` is the quickest way to confirm a live deployment: it exercises
every endpoint, asserts response shapes, and verifies that repeat queries register cache
hits and that mutations invalidate the cache.

## Seeing the cache work

```bash
curl -s "http://localhost:5080/api/v1/policies?region=Japan" > /dev/null
curl -s "http://localhost:5080/api/v1/policies?region=Japan" > /dev/null
curl -s http://localhost:5080/api/v1/cache/stats     # hits: 1

curl -s -X PATCH http://localhost:5080/api/v1/policies/flag \
  -H 'Content-Type: application/json' -d '{"policyIds":["<some-id>"]}'
curl -s http://localhost:5080/api/v1/cache/stats     # entries: 0, generation incremented
```

Asking the Copilot the same question twice shows the same thing in the UI: the second
answer comes back marked `cached`.

## Project layout

```
backend/
  app/
    domain/          Policy aggregate, enums, invariants - no framework imports
    application/     DTOs, filter validation, ports, prompts, AI orchestration
    infrastructure/  SQLAlchemy repositories, caching decorator, LLM adapters
    api/v1/          Versioned routers
    core/            Config, logging, cache, error types
  scripts/verify_api.py   End-to-end verification sweep
  tests/                  69 unit + API tests
frontend/chubb-policy-ui/ Angular 18 standalone-component dashboard
openapi/openapi.yaml      API contract
docs/ARCHITECTURE.md      Layering, trade-offs, what was left out
AI_JOURNAL.md             Chronological decision log
```

## Architecture and trade-offs

See `docs/ARCHITECTURE.md`.
