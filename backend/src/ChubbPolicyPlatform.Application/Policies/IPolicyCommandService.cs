namespace ChubbPolicyPlatform.Application.Policies;

public interface IPolicyCommandService
{
    Task<FlagPoliciesResult> FlagPoliciesAsync(FlagPoliciesRequest request, CancellationToken ct = default);
}
