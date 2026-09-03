using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Testcontainers.PostgreSql;
using Xunit;

namespace ChubbPolicyPlatform.IntegrationTests;

/// <summary>
/// Spins up a real, throwaway Postgres via Testcontainers rather than SQLite —
/// deliberately, since the implementation relies on Postgres-specific behavior
/// (EF.Functions.ILike, enum-as-string, decimal precision) SQLite's EF provider doesn't
/// faithfully emulate. Docker was already a required project deliverable
/// (docker-compose), so this adds no new environment dependency on top of that.
/// Program.cs's own startup code (migrate + seed) runs unmodified against this
/// container, exercising the exact same path used in production.
/// </summary>
public class PolicyApiFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("chubb_policies_test")
        .WithUsername("chubb_app")
        .WithPassword("chubb_test_password")
        .Build();

    public async Task InitializeAsync() => await _container.StartAsync();

    public new async Task DisposeAsync()
    {
        await _container.DisposeAsync();
        await base.DisposeAsync();
    }

    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = _container.GetConnectionString()
            });
        });
    }
}
