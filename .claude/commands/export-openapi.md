---
description: Regenerate openapi/openapi.yaml from the running route/DTO definitions after an API change.
---

Run from `backend/`:

```bash
.venv/Scripts/python scripts/export_openapi.py
```

(Use `.venv/bin/python` on Linux/macOS.)

`openapi/openapi.yaml` is generated, not hand-edited — its own docstring says so.
Run this after any change to a route or DTO, before committing. If you changed
an endpoint and this command wasn't run, the contract has drifted from the code,
which is worse than having no contract at all.
