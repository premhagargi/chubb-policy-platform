# Development workflow

The plan → implement → test → review → commit cycle for this repo, with the
actual commands, not generic advice. See `agents/agents.md` for how the
planner/developer/reviewer roles map onto this.

1. **Plan.** Read `CLAUDE.md` and the relevant `.claude/rules/*.md` files. Use
   plan mode for anything touching a route, DTO, filter, or AI feature —
   these are exactly the changes where skipping a layer is a defect.

2. **Implement.** Follow `.claude/skills/add-endpoint/SKILL.md`'s ordering:
   domain → application → infrastructure → api → frontend. Don't build the
   route before the port it depends on exists.

3. **Regenerate the contract if routes or DTOs changed.**
   ```bash
   cd backend && .venv/Scripts/python scripts/export_openapi.py
   ```
   or the `/export-openapi` command. Skipping this leaves `openapi.yaml`
   drifted from the code, which is worse than not having a contract.

4. **Fast test loop.** Run the `/test-suite` command (`pytest` +
   `npm test`, both offline against the mock LLM provider). Fix failures
   before proceeding — don't move on with a red suite.

5. **Live verification.** Run the `.claude/skills/verify-stack/SKILL.md`
   skill: start both servers, run `scripts/verify_api.py` against `:5080`
   directly and again through the `:4200` Angular proxy. This is the step that
   actually proves cache hits/invalidation, SSE streaming, and AI grounding —
   unit tests alone don't cover any of that. Report the real pass/fail/skip
   counts.

6. **Review.** Check the diff against `.claude/rules/filePlacementRules.md`,
   `.claude/rules/Architecture.md`, and `.claude/rules/safeRules.md`. Confirm
   no secret or generated file was hand-edited.

7. **Commit.** Only after steps 4–6 pass. If `core.hooksPath` is set to
   `.githooks` (see `.githooks/pre-commit`), the commit itself gets a fast
   secret/generated-file check.

## Deferred: AI output quality

The reference governance pattern this workflow is based on includes a
rubric/judge-style validation harness. There's no equivalent built here yet —
`verify-stack` already mechanically checks that Copilot/risk-assessment/brief
responses are grounded and correctly shaped, and no AI-answer-quality
regression has been reported that mechanical checks can't catch. If that
changes, a small LLM-judge harness scoring Policy Copilot, risk assessment, and
portfolio brief output against explicit rubrics would be the next thing to
build — but it's a real subsystem (rubric design, judge prompts, scoring
storage), not a quick addition, so don't start it speculatively.
