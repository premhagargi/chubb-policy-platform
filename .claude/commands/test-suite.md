---
description: Run the backend pytest suite and frontend Karma tests locally (no live servers needed) and summarize failures.
---

Run these two commands and report actual results — do not describe an unrun
command as passing:

```bash
cd backend && .venv/Scripts/python -m pytest
cd frontend/chubb-policy-ui && npm test
```

(Use `.venv/bin/python` on Linux/macOS.)

Report:
- Pass/fail/skip counts for each suite.
- The name and failure message of every failing test, not just the count.
- If both suites pass, say so plainly — don't add hedging about coverage this
  command doesn't provide.

This is the fast local loop. It proves nothing about the live Cerebras
integration, the SSE stream, or cache behavior under real HTTP requests — both
suites run against the mock LLM provider and don't start either server. For
that, use the `verify-stack` skill instead.
