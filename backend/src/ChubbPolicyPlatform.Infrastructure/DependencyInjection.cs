using ChubbPolicyPlatform.Application.Policies;
using ChubbPolicyPlatform.Infrastructure.Persistence;
using ChubbPolicyPlatform.Infrastructure.Persistence.Commands;
using ChubbPolicyPlatform.Infrastructure.Persistence.Queries;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ChubbPolicyPlatform.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        var healthChecks = services.AddHealthChecks();

        // POC mode: no connection string configured (bare `dotnet run`) falls back to EF
        // Core's InMemory provider so the app boots with zero external dependencies. If a
        // real Postgres connection string is supplied (e.g. for the integration tests,
        // which set one explicitly), that's used instead. Swap back to Postgres-only by
        // restoring the throw below.
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            services.AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase("ChubbPolicyPlatformDb"));
        }
        else
        {
            services.AddDbContext<ApplicationDbContext>(options => options.UseNpgsql(connectionString));
            healthChecks.AddNpgSql(connectionString, name: "postgres");
        }

        services.AddScoped<IPolicyQueryService, PolicyQueryService>();
        services.AddScoped<IPolicyCommandService, PolicyCommandService>();

        return services;
    }
}
