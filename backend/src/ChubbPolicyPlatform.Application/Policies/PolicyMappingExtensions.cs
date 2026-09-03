using ChubbPolicyPlatform.Domain.Entities;
using ChubbPolicyPlatform.Domain.Enums;

namespace ChubbPolicyPlatform.Application.Policies;

public static class PolicyMappingExtensions
{
    public static PolicyDto ToDto(this Policy policy) => new(
        policy.Id,
        policy.PolicyNumber,
        policy.PolicyholderName,
        policy.LineOfBusiness.ToWireString(),
        policy.Status.ToString(),
        policy.PremiumAmount,
        policy.Currency.ToString(),
        policy.EffectiveDate,
        policy.ExpiryDate,
        policy.Region.ToWireString(),
        policy.Underwriter,
        policy.FlaggedForReview,
        policy.CreatedAt,
        policy.UpdatedAt);
}
