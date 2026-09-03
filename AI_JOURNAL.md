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
