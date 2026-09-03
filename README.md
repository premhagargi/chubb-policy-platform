# Chubb APAC Policy Management Platform

A Policy Management Platform built for the Chubb APAC Full-Stack Developer take-home
assessment: a .NET 8 Clean Architecture BFF API over PostgreSQL, plus an Angular
dashboard.

## ⚠️ Build status

This repository was authored in an environment **without the .NET 8 SDK or Docker
installed** (confirmed unavailable on PATH at build time). All backend `.sln`/`.csproj`
files and the initial EF Core migration were **hand-written, not CLI-generated**, and the
backend has **not been compiled or run** in this environment. See
`AI_JOURNAL.md` → "Tooling" for details. Before relying on this:

```bash
dotnet build backend/ChubbPolicyPlatform.sln
dotnet test backend/ChubbPolicyPlatform.sln
```

The Angular frontend, by contrast, *was* scaffolded and run with the real Angular CLI
(Node/npm were available), so `frontend/` is in a normally-verified state.

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

- API: http://localhost:5080 (Swagger UI at `/swagger`, health at `/health`)
- Frontend: http://localhost:4200
- Postgres: localhost:5432 (credentials in `.env`)

The database is seeded automatically on first boot with 220 realistic policy records
(see `backend/src/ChubbPolicyPlatform.Infrastructure/Persistence/Seed/PolicySeeder.cs`).

## Running without Docker

**Backend:**
```bash
cd backend
dotnet restore
dotnet ef database update --project src/ChubbPolicyPlatform.Infrastructure --startup-project src/ChubbPolicyPlatform.Api
dotnet run --project src/ChubbPolicyPlatform.Api
```

**Frontend:**
```bash
cd frontend/chubb-policy-ui
npm install
npm start
```

## Testing

```bash
dotnet test backend/ChubbPolicyPlatform.sln          # unit + integration (Testcontainers.PostgreSQL — needs Docker)
cd frontend/chubb-policy-ui && npm test               # Karma/Jasmine unit + component tests
```

## Load test

```bash
npx autocannon -c 50 -d 20 -p 10 http://localhost:5080/api/v1/policies
npx autocannon -c 50 -d 20 -p 10 http://localhost:5080/api/v1/policies/<some-id>
```

Result recorded in `docs/ARCHITECTURE.md` → "Performance".

## Architecture, trade-offs, and what was deliberately left out

See `docs/ARCHITECTURE.md`. Short version: Clean Architecture (Domain → Application ←
Infrastructure, Api on top), Minimal APIs (no MVC controllers), no MediatR/repository
pattern (unnecessary ceremony for 4 endpoints / 1 aggregate), Angular signals (no NgRx),
hand-rolled design tokens + accessibility (no Angular Material). Contract-first OpenAPI
spec is hand-written and hand-implemented rather than codegen'd, given the lack of a
working `dotnet` toolchain to safely run a generator in this environment.

## Project layout

```
openapi/openapi.yaml         contract-first API specification
backend/                     .NET 8 Clean Architecture solution
frontend/chubb-policy-ui/    Angular 21 standalone-component dashboard
docker-compose.yml           postgres + backend + frontend orchestration
docs/ARCHITECTURE.md         architecture, trade-offs, diagram, load-test result
AI_JOURNAL.md                chronological AI-assisted decision log
```
