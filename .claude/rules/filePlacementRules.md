# File placement

Backend package root is `backend/app/`, frontend app root is
`frontend/chubb-policy-ui/src/app/`.

## Backend

```
app/
├── api/            # FastAPI routers — everything under /api/v1 via api/v1/router.py
│   └── v1/
├── application/    # DTOs, ports (Protocols), filters, prompts — no vendor imports
├── core/           # cross-cutting: cache.py, settings, correlation IDs
├── domain/         # aggregates and invariants — no vendor imports
└── infrastructure/
    ├── caching/    # caching decorators wrapping query services
    ├── db/         # SQLAlchemy models, session/engine setup
    ├── llm/        # LlmProvider implementations (Cerebras, mock)
    └── repositories/  # port implementations backed by db/
```

Rules:
- New DTOs → `application/dto.py`; AI-specific response shapes → `application/ai_dto.py`.
- New ports or port methods → `application/ports.py` only.
- New prompt text → `application/prompts.py` only — never a string literal at the
  call site in `AiService` or elsewhere.
- A new SQL-backed port implementation → `infrastructure/repositories/`.
- A new cached read → wrap the port implementation via a class in
  `infrastructure/caching/`; do not add `if cache: ... else: ...` branches inside
  query code itself.
- A new LLM provider → `infrastructure/llm/`, implementing the `LlmProvider` port.
- Wiring — which concrete class satisfies which port, and whether it's
  cache-wrapped — happens only in `api/deps.py`.
- Tests → `backend/tests/`, flat (`test_api.py`, `test_unit.py`,
  `test_references.py`, `conftest.py`) — see `Tests.md`.

## Frontend

```
src/app/
├── core/
│   ├── interceptors/
│   ├── models/     # TS interfaces mirroring backend DTOs (camelCase)
│   └── services/   # HTTP calls + PolicyStateService (owns list state)
├── features/       # route-level feature areas (policies/, settings/)
├── layout/         # shell/nav components
└── shared/
    ├── ui/         # presentational components (e.g. markdown-text.component.ts)
    └── utils/
```

Rules:
- A new backend DTO field that the UI consumes → mirror it in
  `core/models/`.
- A new HTTP call → add it to the relevant service in `core/services/`, not
  inline in a component.
- List/filter state (policies, pagination, active filters) → `PolicyStateService`
  only; components read its signals and call intent methods.
- The AI components (`Policy Copilot`, streaming chat) are the sole exception —
  they own their own request lifecycle because of SSE.
- Feature-specific presentational pieces → `features/<area>/`; anything reused
  across features → `shared/ui/`.
