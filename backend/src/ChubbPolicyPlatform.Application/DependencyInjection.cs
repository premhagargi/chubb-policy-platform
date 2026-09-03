using ChubbPolicyPlatform.Application.Policies;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace ChubbPolicyPlatform.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IValidator<PolicyFilterRequest>, PolicyFilterRequestValidator>();
        services.AddScoped<IValidator<FlagPoliciesRequest>, FlagPoliciesRequestValidator>();
        return services;
    }
}
