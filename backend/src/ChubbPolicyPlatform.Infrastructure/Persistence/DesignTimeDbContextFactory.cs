using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ChubbPolicyPlatform.Infrastructure.Persistence;

/// <summary>
/// Lets `dotnet ef migrations add` / `dotnet ef database update` run against this
/// project directly (no --startup-project needed) by supplying a connection string from
/// the CHUBB_DB_CONNECTION env var, falling back to the local dev default used by
/// docker-compose's exposed Postgres port.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("CHUBB_DB_CONNECTION")
            ?? "Host=localhost;Port=5432;Database=chubb_policies;Username=chubb_app;Password=chubb_dev_password";

        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new ApplicationDbContext(optionsBuilder.Options);
    }
}
