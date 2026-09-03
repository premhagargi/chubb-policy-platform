using ChubbPolicyPlatform.Application.Policies;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;

namespace ChubbPolicyPlatform.Api.Endpoints;

public static class PolicyEndpoints
{
    public static IEndpointRouteBuilder MapPolicyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/policies").WithTags("Policies");

        group.MapGet("", ListPolicies);
        group.MapGet("/{id:guid}", GetPolicyById);
        group.MapPatch("/flag", FlagPolicies);
        group.MapGet("/summary", GetSummary);

        return app;
    }

    private static async Task<IResult> ListPolicies(
        [AsParameters] PolicyListQuery query,
        IPolicyQueryService queryService,
        IValidator<PolicyFilterRequest> validator,
        CancellationToken ct)
    {
        var request = query.ToFilterRequest();
        await validator.ValidateAndThrowAsync(request, ct);

        var result = await queryService.GetPoliciesAsync(request, ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> GetPolicyById(Guid id, IPolicyQueryService queryService, CancellationToken ct)
    {
        var policy = await queryService.GetByIdAsync(id, ct);
        return policy is null ? Results.NotFound() : Results.Ok(policy);
    }

    private static async Task<IResult> FlagPolicies(
        FlagPoliciesRequest request,
        IPolicyCommandService commandService,
        IValidator<FlagPoliciesRequest> validator,
        CancellationToken ct)
    {
        await validator.ValidateAndThrowAsync(request, ct);
        var result = await commandService.FlagPoliciesAsync(request, ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> GetSummary(
        [AsParameters] PolicySummaryQuery query,
        IPolicyQueryService queryService,
        IValidator<PolicyFilterRequest> validator,
        CancellationToken ct)
    {
        var request = query.ToFilterRequest();
        await validator.ValidateAndThrowAsync(request, ct);

        var summary = await queryService.GetSummaryAsync(request, ct);
        return Results.Ok(summary);
    }
}

/// <summary>Binds GET /policies query parameters — kept separate from PolicyFilterRequest
/// (the Application-layer DTO) so query-string binding concerns don't leak inward.</summary>
public class PolicyListQuery
{
    public int Page { get; set; } = 1;
    public int Size { get; set; } = 20;
    public string? Sort { get; set; }
    public string? Status { get; set; }
    public string? LineOfBusiness { get; set; }
    public string? Region { get; set; }
    public DateOnly? EffectiveDateFrom { get; set; }
    public DateOnly? EffectiveDateTo { get; set; }
    public string? Search { get; set; }

    public PolicyFilterRequest ToFilterRequest() => new()
    {
        Page = Page,
        Size = Size,
        Sort = Sort,
        Status = Status,
        LineOfBusiness = LineOfBusiness,
        Region = Region,
        EffectiveDateFrom = EffectiveDateFrom,
        EffectiveDateTo = EffectiveDateTo,
        Search = Search
    };
}

public class PolicySummaryQuery
{
    public string? Status { get; set; }
    public string? LineOfBusiness { get; set; }
    public string? Region { get; set; }
    public DateOnly? EffectiveDateFrom { get; set; }
    public DateOnly? EffectiveDateTo { get; set; }
    public string? Search { get; set; }

    public PolicyFilterRequest ToFilterRequest() => new()
    {
        Status = Status,
        LineOfBusiness = LineOfBusiness,
        Region = Region,
        EffectiveDateFrom = EffectiveDateFrom,
        EffectiveDateTo = EffectiveDateTo,
        Search = Search
    };
}
