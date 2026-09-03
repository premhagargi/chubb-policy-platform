namespace ChubbPolicyPlatform.Application.Policies;

public record FlagPoliciesRequest(IReadOnlyList<Guid> PolicyIds);

public record FlagPoliciesResult(IReadOnlyList<Guid> FlaggedPolicyIds)
{
    public int FlaggedCount => FlaggedPolicyIds.Count;
}
