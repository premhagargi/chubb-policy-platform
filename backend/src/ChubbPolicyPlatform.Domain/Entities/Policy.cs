using ChubbPolicyPlatform.Domain.Enums;

namespace ChubbPolicyPlatform.Domain.Entities;

public class Policy
{
    public Guid Id { get; private set; }
    public string PolicyNumber { get; private set; } = string.Empty;
    public string PolicyholderName { get; private set; } = string.Empty;
    public LineOfBusiness LineOfBusiness { get; private set; }
    public PolicyStatus Status { get; private set; }
    public decimal PremiumAmount { get; private set; }
    public Currency Currency { get; private set; }
    public DateOnly EffectiveDate { get; private set; }
    public DateOnly ExpiryDate { get; private set; }
    public Region Region { get; private set; }
    public string Underwriter { get; private set; } = string.Empty;
    public bool FlaggedForReview { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    // EF Core materialization constructor
    private Policy() { }

    public static Policy Create(
        string policyNumber,
        string policyholderName,
        LineOfBusiness lineOfBusiness,
        PolicyStatus status,
        decimal premiumAmount,
        Currency currency,
        DateOnly effectiveDate,
        DateOnly expiryDate,
        Region region,
        string underwriter,
        bool flaggedForReview = false)
    {
        if (premiumAmount is < 1_000 or > 5_000_000)
            throw new ArgumentOutOfRangeException(nameof(premiumAmount), premiumAmount,
                "Premium amount must be between 1,000 and 5,000,000.");

        if (expiryDate <= effectiveDate)
            throw new ArgumentException("Expiry date must be after the effective date.", nameof(expiryDate));

        var now = DateTimeOffset.UtcNow;

        return new Policy
        {
            Id = Guid.NewGuid(),
            PolicyNumber = policyNumber,
            PolicyholderName = policyholderName,
            LineOfBusiness = lineOfBusiness,
            Status = status,
            PremiumAmount = premiumAmount,
            Currency = currency,
            EffectiveDate = effectiveDate,
            ExpiryDate = expiryDate,
            Region = region,
            Underwriter = underwriter,
            FlaggedForReview = flaggedForReview,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    public void Flag()
    {
        FlaggedForReview = true;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    /// <summary>Renewal/extension: moves the expiry date out. Used by the seeder to
    /// produce a realistic spread of "expiring soon" policies; a normal aggregate
    /// behavior, not a seeding-only backdoor.</summary>
    public void ExtendExpiryTo(DateOnly newExpiryDate)
    {
        if (newExpiryDate <= EffectiveDate)
            throw new ArgumentException("Expiry date must be after the effective date.", nameof(newExpiryDate));

        ExpiryDate = newExpiryDate;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
