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
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");

        services.AddDbContext<ApplicationDbContext>(options => options.UseNpgsql(connectionString));

        services.AddScoped<IPolicyQueryService, PolicyQueryService>();
        services.AddScoped<IPolicyCommandService, PolicyCommandService>();

        services.AddHealthChecks()
            .AddNpgSql(connectionString, name: "postgres");

        return services;
    }
}
