# Migrations — generate before first run

No `dotnet` SDK was available in the environment this repo was authored in, so the
initial EF Core migration (the `Migration` subclass **and** its auto-generated
`.Designer.cs`/`ApplicationDbContextModelSnapshot.cs` companions) could not be produced
by the real tooling here. Hand-fabricating those generated files was deliberately
avoided — they encode exact EF Core/Npgsql metadata annotations that are easy to get
subtly wrong in a way a hand-reviewer (or the author, without a compiler) won't catch,
which would be worse than simply not having them yet.

**Run this once, from `backend/`, before anything else:**

```bash
dotnet tool install --global dotnet-ef   # if not already installed
dotnet ef migrations add InitialCreate \
  --project src/ChubbPolicyPlatform.Infrastructure \
  --startup-project src/ChubbPolicyPlatform.Api
```

This reads the fully-written `Policy` entity (`Domain/Entities/Policy.cs`) and
`PolicyConfiguration` (`Persistence/Configurations/PolicyConfiguration.cs`) — both of
which *are* complete and reviewed — and generates a migration that exactly matches them.
`Program.cs` already calls `dbContext.Database.Migrate()` on startup, so once this
migration exists, `docker-compose up` applies it automatically with no further steps.
