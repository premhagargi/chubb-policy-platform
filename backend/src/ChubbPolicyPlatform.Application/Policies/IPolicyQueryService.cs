using ChubbPolicyPlatform.Application.Common;

namespace ChubbPolicyPlatform.Application.Policies;

/// <summary>
/// Owned by Application, implemented by Infrastructure (Dependency Inversion) — Api and
/// Application code against this interface, never against EF Core directly.
/// </summary>
public interface IPolicyQueryService
{
    Task<PagedResult<PolicyDto>> GetPoliciesAsync(PolicyFilterRequest request, CancellationToken ct = default);

    Task<PolicyDto?> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<PolicySummaryDto> GetSummaryAsync(PolicyFilterRequest request, CancellationToken ct = default);
}
