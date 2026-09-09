---
name: verify-stack
description: Start the FastAPI backend and Angular dev server, then run the end-to-end verification sweep across every endpoint and the caching behaviour. Use when asked to verify, smoke-test, or prove the stack works, or before reporting that a change is done.
---

# Verify the stack

Proves the running system actually works, rather than inferring it from unit tests. The
test suite runs against the **mock** LLM provider and never touches the network, so it
says nothing about the live Cerebras integration, the SSE stream, or cache behaviour
under real requests. This does.

## 1. Start the backend

From `backend/`:

```bash
.venv/Scripts/python -m uvicorn app.main:app --port 5080
```

Use `.venv/bin/python` on Linux/macOS. Run it in the background and wait for
`http://localhost:5080/health` to return 200 — do not poll with `sleep` in a loop.

Confirm from the startup log that all three lines appear:

- `Database schema ready.`
- `Seeded policies.` with `rows: 220` (only on a fresh database)
- `LLM provider: cerebras` — or `mock`, if no `CEREBRAS_API_KEY` is set

If it says `mock`, that is not a failure; it means `backend/.env` has no key. Say so in
the report rather than treating the AI results as proof of the live integration.

## 2. Start the frontend (only if verifying the browser path)

From `frontend/chubb-policy-ui/`:

```bash
npx ng serve --port 4200
```

Wait for `http://localhost:4200` to return 200.

## 3. Run the sweep

```bash
cd backend
.venv/Scripts/python scripts/verify_api.py                        # direct to the API
.venv/Scripts/python scripts/verify_api.py http://localhost:4200  # through the Angular proxy
```

The script hits every endpoint, asserts response shapes, and checks that:

- a repeat query registers a cache **hit**
- a mutation bumps the cache **generation** and clears entries
- a cached summary never hides a just-applied flag
- the Copilot answer is grounded in the scoped data
- a policy can be looked up by number *and* by policyholder name
- the SSE stream emits tokens and terminates with `done`

Against `:4200`, `/health` and `/openapi.json` are reported as **SKIP** — the dev server
proxies only `/api`. That is expected, not a failure.

## 4. Report

State the actual counts (`N passed, M failed, K skipped`) and which provider and model
answered. If anything failed, quote the failing check and its detail line; do not
summarise a failure as a pass.

## Cleaning up

Stop both servers when done. On Windows, the SQLite file and `node_modules` binaries stay
locked while a process holds them, so kill the processes before deleting anything:

```powershell
Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" |
  Where-Object { $_.ExecutablePath -like "*chubb-policy-platform*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

## Related

- `backend/scripts/verify_api.py` — the sweep itself; add a check here when adding an endpoint
- `CLAUDE.md` — layering rules and conventions
