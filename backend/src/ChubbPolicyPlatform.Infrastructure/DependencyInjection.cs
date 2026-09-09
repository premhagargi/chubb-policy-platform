using ChubbPolicyPlatform.Application.Policies;
using ChubbPolicyPlatform.Infrastructure.Caching;
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

        // --- Caching ---
        services.AddMemoryCache();
        services.AddSingleton<PolicyCacheInvalidator>();

        // Register the real query service under its own concrete type so the decorator
        // can resolve it without a circular dependency.
        services.AddScoped<PolicyQueryService>();
        services.AddScoped<IPolicyQueryService>(sp =>
            new CachedPolicyQueryService(
                sp.GetRequiredService<PolicyQueryService>(),
                sp.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>(),
                sp.GetRequiredService<PolicyCacheInvalidator>(),
                sp.GetRequiredService<Microsoft.Extensions.Logging.ILogger<CachedPolicyQueryService>>()));

        services.AddScoped<IPolicyCommandService, PolicyCommandService>();

        return services;
    }
}
