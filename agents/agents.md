# Agent roles

This project doesn't run a separate multi-agent framework — it uses Claude
Code's own primitives (plan mode, the `Explore`/`Plan`/general-purpose
subagents). This document just names the roles those primitives already play
and their boundaries, so "planner", "developer", and "reviewer" mean something
concrete here.

## Planner

Maps to: plan mode, or an `Explore`-then-`Plan` agent pass.

- Reads `CLAUDE.md` and the relevant `.claude/rules/*.md` files before touching
  anything else.
- Uses read-only tools only (Glob, Grep, Read, and the `Explore` subagent) —
  never `Edit`/`Write` to source, never a mutating `Bash` command.
- Produces a plan file naming the concrete files to change and the verification
  steps, per the layering order in `.claude/skills/add-endpoint/SKILL.md` when
  the change is endpoint-shaped.
- Boundary: does not implement. A plan that can't be executed by someone else
  reading only the plan file is incomplete.

## Developer

Maps to: the implementing agent after a plan is approved, or a general-purpose
subagent handed a scoped, already-understood task.

- Implements exactly what the approved plan describes — no unrequested
  refactors, no scope creep.
- Follows the layering order from `.claude/skills/add-endpoint/SKILL.md`:
  domain → application → infrastructure → api → frontend.
- Runs `/test-suite` before declaring anything done, and regenerates
  `openapi/openapi.yaml` (`/export-openapi`) if a route or DTO changed.
- Boundary: does not skip the verification step to save time, and does not
  report an unrun command as passing (see `CLAUDE.md` > "Before you say it
  works").

## Reviewer

Maps to: a second-pass general-purpose subagent, or the human reviewing the
diff before commit.

- Checks the diff against `.claude/rules/filePlacementRules.md` and
  `.claude/rules/Architecture.md` — wrong-layer code is a defect even if it
  works.
- Confirms any new mutation invalidates the cache
  (`.claude/rules/safeRules.md`).
- Confirms the `verify-stack` skill actually ran against a live stack before
  "it works" was reported — not just that unit tests passed.
- Confirms no secret or generated file (`backend/.env`,
  `openapi/openapi.yaml`) was hand-edited.
- Boundary: nothing gets committed on the strength of AI-generated code alone.
  Review is a gate, not a formality — this mirrors `CLAUDE.md`'s existing rule
  that failures must be reported with actual output, never inferred.
