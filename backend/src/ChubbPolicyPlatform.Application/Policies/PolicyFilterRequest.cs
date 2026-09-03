namespace ChubbPolicyPlatform.Application.Policies;

/// <summary>
/// Shared by both GET /policies and GET /policies/summary — the summary endpoint
/// applies the same filters (minus Page/Size/Sort) so its numbers always describe
/// exactly the set the caller is currently looking at in the list.
/// </summary>
public class PolicyFilterRequest
{
    public int Page { get; init; } = 1;
    public int Size { get; init; } = 20;
    public string? Sort { get; init; }
    public string? Status { get; init; }
    public string? LineOfBusiness { get; init; }
    public string? Region { get; init; }
    public DateOnly? EffectiveDateFrom { get; init; }
    public DateOnly? EffectiveDateTo { get; init; }
    public string? Search { get; init; }
}
