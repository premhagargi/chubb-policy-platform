"""Write the API's OpenAPI document to openapi/openapi.yaml.

The contract is generated from the code rather than hand-maintained alongside
it: a hand-written spec drifts the moment someone adds a field, and a drifted
contract is worse than none. Run this after changing any route or DTO.

Usage (from backend/):
    python scripts/export_openapi.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import create_app  # noqa: E402

OUTPUT = Path(__file__).resolve().parents[2] / "openapi" / "openapi.yaml"

HEADER = (
    "# Generated from the FastAPI application - do not edit by hand.\n"
    "# Regenerate with: python scripts/export_openapi.py\n\n"
)


def main() -> None:
    document = create_app().openapi()

    body = yaml.safe_dump(
        document,
        sort_keys=False,      # preserve the order FastAPI emits: info, paths, components
        default_flow_style=False,
        allow_unicode=True,
        width=100,
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(HEADER + body, encoding="utf-8")

    print(f"Wrote {OUTPUT} ({len(document['paths'])} paths)")


if __name__ == "__main__":
    main()
