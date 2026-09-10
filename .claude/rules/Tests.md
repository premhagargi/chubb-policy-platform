# Tests

## Layout

`backend/tests/` is flat, no `unit/`/`integration/` split:
- `test_api.py` — behavior through the real ASGI app (HTTP-shaped assertions).
- `test_unit.py` — logic in isolation (filters, DTOs, cache mechanics).
- `test_references.py` — policy-number/policyholder-name resolution used by the
  AI copilot.
- `conftest.py` — shared fixtures, including the mock LLM provider wiring.

Frontend tests are Karma/Jasmine (`npm test` from
`frontend/chubb-policy-ui/`); `policy-state.service.spec.ts` specifically covers
the NG0600 signal-write-in-`effect()` regression — don't remove that coverage
when refactoring `PolicyStateService`.

## Rules

- Tests must never touch the network. `LLM_PROVIDER=mock` in test settings
  selects the mock provider — do not add a test that requires
  `CEREBRAS_API_KEY` to pass.
- A new mutation needs a test that mutates and then re-reads, proving the cache
  was actually invalidated — not just that the mutation itself succeeded.
- A new endpoint needs a check added to `backend/scripts/verify_api.py`, not just
  unit coverage. An endpoint absent from the sweep is not covered by the thing
  that actually proves the system works end-to-end.
- A unit-test pass is not sufficient grounds to report a change as "working."
  Unit tests run against the mock provider and prove nothing about the live
  Cerebras integration, the SSE stream, or cache behavior under real HTTP
  requests — that's what the `verify-stack` skill is for. See
  `CLAUDE.md` > "Before you say it works".

## Commands

```bash
cd backend && .venv/Scripts/python -m pytest
cd frontend/chubb-policy-ui && npm test
```

or use the `/test-suite` command, which runs both and summarizes failures.
