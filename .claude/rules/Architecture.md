# Architecture

Granular companion to `CLAUDE.md` > "Layering — the rule that matters". Read that
first; this file is the checklist you consult while actually placing code.

## Import direction

```
api → application → domain
infrastructure → application → domain
```

- `domain/` and `application/` must **never** import SQLAlchemy, FastAPI, `httpx`,
  the Cerebras SDK, or anything else vendor-specific. If a file under either needs
  one of those imports, the code belongs in `infrastructure/` instead, behind a
  port.
- Ports live only in `application/ports.py`, declared as structural `Protocol`s.
  Implementations in `infrastructure/` satisfy the protocol by shape — they do
  **not** import it. The arrow points one way.
- `api/deps.py` is the single composition root: the only place that knows which
  concrete `infrastructure/` class satisfies which `application/ports.py` port
  (including whether it's wrapped in the caching decorator). No other file wires
  concrete classes to ports.

## "Where does X go" table

| Adding... | Goes in |
|---|---|
| A new invariant / state transition on a policy | `app/domain/` — a method on the aggregate, never a mutation from a service |
| A new field on the wire | `app/application/dto.py` (or `ai_dto.py` for AI responses), subclassing `CamelModel` |
| A new filter | `app/application/filters.py` — add to `PolicyFilter`, validate in `parse_policy_filter`, add to `cache_key` |
| A new port method | `app/application/ports.py` |
| A new SQL-backed implementation | `app/infrastructure/repositories/` |
| A cached read | `app/infrastructure/caching/` — wrap via decorator, never branch inside query code |
| A new AI prompt | `app/application/prompts.py` — never inline at the call site |
| A new route | `app/api/v1/`, mounted through `router.py` under `/api/v1` |
| Wiring a port to its implementation | `app/api/deps.py` only |
| A new frontend data model | `frontend/chubb-policy-ui/src/app/core/models/` |
| A new frontend HTTP call | `frontend/chubb-policy-ui/src/app/core/services/` |
| New shared list/filter UI state | `PolicyStateService` — components read signals and call intent methods, never issue their own HTTP (AI components are the one exception) |

See `.claude/skills/add-endpoint/SKILL.md` for the full worked order of operations
when a change spans every layer.
