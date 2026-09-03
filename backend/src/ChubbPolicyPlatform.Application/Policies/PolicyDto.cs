namespace ChubbPolicyPlatform.Application.Policies;

public record PolicyDto(
    Guid Id,
    string PolicyNumber,
    string PolicyholderName,
    string LineOfBusiness,
    string Status,
    decimal PremiumAmount,
    string Currency,
    DateOnly EffectiveDate,
    DateOnly ExpiryDate,
    string Region,
    string Underwriter,
    bool FlaggedForReview,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
