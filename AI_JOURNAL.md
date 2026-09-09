# AI Working Journal

A running, chronological log of AI-assisted decisions made while building this platform:
what was suggested, what was accepted, challenged, or overridden, and why. Entries are
added as decisions are made, not reconstructed afterward.

Format:
```
## [Component/Decision] — YYYY-MM-DD
**Suggested:** what the AI proposed
**Decision:** accepted / challenged-and-modified / overridden
**Why:** 1-2 sentence rationale
```

---

## Tooling — 2026-09-03
**Suggested:** Use `dotnet new sln`/`dotnet new classlib`/`dotnet new webapi` to scaffold
the backend, and `dotnet ef migrations add` to generate the first migration.
**Decision:** Overridden.
**Why:** The .NET 8 SDK is not installed on this machine. All `.sln`/`.csproj` files and
the initial EF Core migration are hand-written instead of CLI-generated. This is a real
constraint, not a style choice — the project has **not been build-verified** by `dotnet
build`/`dotnet test` in this environment. Install the .NET 8 SDK and run `dotnet build`
+ `dotnet test` before trusting this compiles; hand-written project files are the most
likely source of any first-build errors (package version mismatches, missing references).

## Contract-first vs. code generation — 2026-09-03
**Suggested:** Use NSwag/OpenAPI Generator to generate server stubs directly from
`openapi/openapi.yaml`, satisfying the spec's "drive server stubs and code generation"
instruction literally.
**Decision:** Challenged and modified — hand-write both the spec and the implementation,
kept in sync manually, with .NET's built-in OpenAPI support serving `/swagger` as a live
dev explorer (not the source of truth).
**Why:** True codegen-from-spec is more setup risk than the time budget affords, and
without a working `dotnet` toolchain in this environment to validate a generator run,
it's a bigger gamble than writing the contract carefully by hand first and coding
directly against it. Documented as a deliberate, known deviation from the literal
instruction — see `docs/ARCHITECTURE.md`.

## API style — 2026-09-03
**Suggested:** Minimal API endpoints instead of MVC controllers.
**Decision:** Accepted.
**Why:** Faster to write correctly for 4 endpoints, idiomatic .NET 8, integrates cleanly
with built-in OpenAPI tooling. Either is defensible; noted in case the panel expects
controllers.

## CQRS / mediator — 2026-09-03
**Suggested:** MediatR with a full request/handler/pipeline-behavior setup.
**Decision:** Overridden.
**Why:** Four endpoints don't justify mediator ceremony. Plain Application-layer service
interfaces injected directly into endpoints keep the same Clean Architecture boundary
(Api depends on Application abstractions, not concretions) without the extra framework
surface to write and defend under time pressure.

## Repository pattern — 2026-09-03
**Suggested:** A generic `IRepository<T>`/`IPolicyRepository` layer wrapping EF Core.
**Decision:** Overridden.
**Why:** Single aggregate (`Policy`); an `IApplicationDbContext` interface owned by the
Application layer already gives Dependency Inversion (Application doesn't reference EF
Core types directly) without an extra abstraction that adds indirection but not
capability here.

## Backend integration test database — 2026-09-03
**Suggested:** SQLite in-memory as the integration-test database (faster, no Docker
dependency for `dotnet test`).
**Decision:** Overridden — use `Testcontainers.PostgreSQL` instead.
**Why:** The implementation deliberately relies on Postgres-specific behavior
(`EF.Functions.ILike`, enum-as-string conversions, `decimal(18,2)` precision) that
SQLite's EF provider does not faithfully emulate. A green SQLite suite would be false
confidence — worse than no integration tests for a "pristine backend" bar. Docker is
already a required project deliverable (docker-compose), so this doesn't introduce new
environment risk on top of what's already assumed.

## Frontend state management — 2026-09-03
**Suggested:** NgRx store for filters/paging/sort/search state.
**Decision:** Overridden — Angular signals in a single `PolicyStateService`.
**Why:** Idiomatic for Angular 17+/21 at this state complexity; NgRx would be ceremony,
not rigor, for four filter fields plus paging/sort. Signals + `computed` + URL
query-param sync achieve the same shareable-URL requirement with far less code.

## Frontend UI library — 2026-09-03
**Suggested:** Angular Material for the table, filters, and theming.
**Decision:** Overridden — hand-rolled semantic HTML/SCSS components.
**Why:** Wanted direct control over both the design-token theming system and
accessibility (ARIA, focus management) rather than learning and overriding a library's
own theming/a11y surface under time pressure. Substituting one legitimate approach for
another, not skipping the requirement.

## Performance target — 2026-09-03
**Suggested:** Rely on indexes + `AsNoTracking()`/projection and assert the p95<300ms
target is met without measuring it.
**Decision:** Challenged and modified — added an explicit load-test step using
`npx autocannon` (no new tool install needed; Node is already present) against the
running docker-composed stack, with the actual measured p95 recorded in
`docs/ARCHITECTURE.md` rather than assumed.
**Why:** It's a named, numeric requirement in the spec, not a vague performance
aspiration — an honestly reported measured number is worth more in the panel Q&A than an
unverified claim of meeting it.

## npm install failure on Angular 21 scaffold — 2026-09-03
**Suggested:** N/A — this was a real tooling failure hit while scaffolding, not an AI
suggestion.
**Decision:** Diagnosed and fixed, not overridden.
**Why:** `ng new` followed by `npm install` failed with `Cannot read properties of null
(reading 'edgesOut')` inside npm's arborist dependency resolver — a known npm bug
triggered by the new Angular 21 default toolchain's vitest peer-dependency graph.
`npm install --legacy-peer-deps` resolved it. The same flag is used in the frontend
Dockerfile for the same reason. Verified: `npm install --legacy-peer-deps`, `ng test`,
and `ng build --configuration production` all ran successfully in this environment
(unlike the backend, the frontend genuinely was built and tested here, not just
authored).

## Signal ordering bug in ThemeService — 2026-09-03
**Suggested:** N/A — caught by actually running the frontend test suite, not proposed
and accepted blind.
**Decision:** Fixed via two changes, not just patched around.
**Why:** First bug: a constructor-injected `StorageService` (`constructor(private
storage: StorageService)`) was read from a class-field initializer
(`readonly preference = signal(this.readInitialPreference())`) — under real ES class
field semantics, field initializers run before the constructor body assigns parameter
properties, so `this.storage` was `undefined` at that point. Fixed by switching to an
`inject(StorageService)` field declared first in the class, which has no such ordering
hazard. Second bug: `resolvedTheme` was a plain `signal()` updated from inside an
`effect()`, and Angular effects run asynchronously (batched into the next reactivity
flush) — a test calling `setPreference()` then immediately asserting on
`resolvedTheme()` saw the stale value. Fixed by making `resolvedTheme` a `computed()`
instead, which re-evaluates synchronously on read. Both were caught only because `ng
test` was actually run against real code, not inferred from reading the source.

## Backend rewritten: .NET 8 → Python/FastAPI — 2026-09-09
**Suggested:** Full rewrite, per the POC requirements reissued by the lead (backend must
be Python/FastAPI or Node.js).
**Decision:** Rewrote the backend in FastAPI, deleted the .NET solution, and kept the
layering, the `/api/v1` surface and the `ErrorResponse` shape identical.
**Why:** The .NET implementation was complete and working, so the cheapest correct path
was a port that preserves the contract rather than a redesign — the Angular client
needed no changes to any existing call. Structural `Protocol` ports replace the C#
interfaces, which additionally keeps the dependency arrow one-way: `infrastructure`
never imports `application.ports`, where in C# the implementations had to reference the
interfaces they implemented.

## pydantic renders Decimal as a JSON string — 2026-09-09
**Suggested:** N/A — caught while writing the DTO layer, before it reached the UI.
**Decision:** `premiumAmount` crosses the wire as a JSON number via a `PlainSerializer`;
`Decimal` remains the in-process type.
**Why:** pydantic v2 serialises `Decimal` to a *string* in JSON mode by default. The
Angular app does arithmetic and currency formatting on `premiumAmount`, so this would
have silently broken every chart and total — with no server-side error to notice. A
two-decimal premium capped at 5,000,000 is exactly representable in float64, so the
conversion is lossless at this boundary. There is a regression test asserting the JSON
type specifically.

## FastAPI validates one field at a time — 2026-09-09
**Suggested:** Declare bounds as `Query(ge=1, le=100)`, the idiomatic FastAPI way.
**Decision:** Rejected. All filter validation goes through one `parse_policy_filter`
that collects every problem and raises once.
**Why:** FastAPI rejects on the first failing constraint, so a request with four bad
parameters reports one. The previous FluentValidation implementation reported all of
them, and a caller should be able to fix a bad request in a single round trip. Verified
by a test asserting all four field names come back together.

## Cerebras model selection — 2026-09-09
**Suggested:** Default to `llama-3.3-70b`, and I initially flagged the user-supplied
`qwen-3.8-27b` as not a real model id.
**Decision:** Wrong on both counts — corrected by querying `client.models.list()`. This
key's available models are `gemma-4-31b` (listed but 404s — no access), `qwen-3.8-27b`
and `gpt-oss-120b`. Settled on `gpt-oss-120b`, env-overridable.
**Why:** Worth recording as a mistake: I asserted a model id was invalid from memory
rather than asking the API, which cost a round of debugging. The related real finding is
that qwen-3.x is a reasoning model whose hidden reasoning tokens are drawn from
`max_completion_tokens` — at 900 the budget was exhausted before any content was
emitted, so the SDK returned a *successful* response with `content: None`. Default
raised to 4000, and the adapter now reports "increase LLM_MAX_TOKENS" when
`finish_reason == "length"` rather than a bare "empty completion".

## Grounding the Copilot in specific policies — 2026-09-09
**Suggested:** Ground prompts in the summary aggregates plus a sample of rows.
**Decision:** Kept that, and added `references.py` — textual extraction of policy
numbers, quoted terms and proper nouns, each resolved to real records appended to the
context.
**Why:** With aggregates alone, "why is PCL-100219 flagged?" was answered — correctly
but uselessly — with "the context does not contain that policy", because the statistical
sample almost never includes the one row the user asked about. Heuristics rather than an
LLM call for entity extraction: it runs in microseconds, costs nothing, and a false
positive only adds a few unused rows to the prompt. The lookups deliberately ignore the
active filter, so a policy number found while the Flagged view is open still resolves.

## Rendering model output as Markdown — 2026-09-09
**Suggested:** `marked` + `DOMPurify`, the usual pairing.
**Decision:** A ~100-line parser that renders through Angular template bindings instead.
**Why:** Model output is untrusted text that can quote policyholder-supplied names. With
bindings there is no HTML string anywhere in the path for an injection to ride in on, so
the sanitiser is not a control that can be misconfigured — it is not needed at all. It
also avoids two dependencies for five constructs (bullets, numbers, bold, italic, code).

## Angular 21 → 18 — 2026-09-09
**Suggested:** Downgrade to meet the stated Angular 18 requirement.
**Decision:** Done. Required more than a version bump: `standalone: true` added
explicitly to all 22 components (default only from v19), `zone.js` restored to
polyfills (v21 is zoneless by default), `provideBrowserGlobalErrorListeners` removed
(v20+), Karma/Jasmine in place of the v20+ Vitest builder, and `module: preserve`
swapped for `ES2022`/`bundler` (TS 5.5).
**Why:** Two things worth noting for anyone repeating this. Angular's `@else if` does not
support the `as` alias that `@if` does, so aliased branches had to be nested rather than
chained — the compiler error for this points at the *body*, not the alias. And Tailwind 4
is retained: Angular 18's builder declares an optional peer on Tailwind ≤3, which does
not describe how this build works (Tailwind runs through an explicit `.postcssrc.json`),
so `.npmrc` records `legacy-peer-deps=true` rather than downgrading a working stylesheet.

## Verification — 2026-09-09
**Decision:** Added `backend/scripts/verify_api.py`, an end-to-end sweep run against the
live stack.
**Why:** Unit tests use the mock provider and never touch the network, which is correct
for a test suite but proves nothing about the actual Cerebras integration. The sweep hits
every endpoint against a running server and asserts the things a reviewer would check by
hand: response shapes, that repeat queries register cache hits, that a mutation bumps the
cache generation, and that a cached summary never hides a just-applied flag. Last run:
57 passed / 0 failed against live Cerebras, and 55 passed / 2 skipped through the Angular
proxy (`/health` and `/openapi.json` are not proxied — the dev server forwards only
`/api`).

## NG0600: every page loaded empty until Refresh — 2026-09-09
**Suggested:** N/A — reported by the user, and a regression I introduced.
**Decision:** Added `{ allowSignalWrites: true }` to the three effects that write
signals, and a spec covering initial load.
**Why:** Writing to a signal inside `effect()` throws NG0600 on Angular 18 unless opted
into; the flag became the default and was removed in v19, so code written against the
original Angular 21 target had no reason to carry it. The data-loading effect calls
`fetch()`, which sets `_status` synchronously — so on every page the effect threw, no
request was issued, and the table stayed empty. The Refresh button appeared to "fix" it
only because `refetch()` calls `fetch()` directly, outside any effect. Nothing failed at
build time and no test covered the load path, which is why it shipped. The new
`policy-state.service.spec.ts` was verified to actually catch it: 4 failures with the fix
reverted, 15/15 with it in place.

## One-hue palette — 2026-09-09
**Suggested:** By the user: white, off-white, orange, grey text, black buttons, nothing
else.
**Decision:** Rebuilt the token set around a single accent. Chrome (sidebar + header) got
its own `--chrome-*` tokens so it can be off-white on light and black on dark
independently of the content surface.
**Why:** Three consequences worth recording, because each was a place the constraint
changed behaviour rather than just colour. (1) Status can no longer be encoded by hue, so
it is encoded by tone, and orange is reserved for the two states that ask something of
the operator — pending and flagged. (2) Error surfaces had been borrowing the "Cancelled"
status token, which in the new palette is the *faintest* grey in the system; an error
would have been the least visible thing on screen, so errors now take the accent. (3)
Buttons painted `var(--brand)` relied on a literal `text-white` class, which breaks the
moment `--brand` inverts to off-white on dark — nine of them now use `--brand-contrast`,
which inverts with the button.
