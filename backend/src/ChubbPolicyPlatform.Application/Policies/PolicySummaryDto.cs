namespace ChubbPolicyPlatform.Application.Policies;

public record PolicySummaryDto(
    IReadOnlyDictionary<string, int> CountsByStatus,
    IReadOnlyDictionary<string, decimal> PremiumByLineOfBusiness,
    int ExpiringSoonCount);
