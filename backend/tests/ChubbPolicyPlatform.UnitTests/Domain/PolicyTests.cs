using ChubbPolicyPlatform.Domain.Entities;
using ChubbPolicyPlatform.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace ChubbPolicyPlatform.UnitTests.Domain;

public class PolicyTests
{
    private static Policy ValidPolicy(decimal premium = 10_000m) => Policy.Create(
        "PCL-000001", "Jane Tan", LineOfBusiness.Property, PolicyStatus.Active,
        premium, Currency.SGD,
        new DateOnly(2026, 1, 1), new DateOnly(2027, 1, 1),
        Region.Singapore, "John Underwriter");

    [Theory]
    [InlineData(999)]
    [InlineData(5_000_001)]
    public void Create_RejectsPremiumOutsideAllowedRange(decimal premium)
    {
        var act = () => ValidPolicy(premium);
        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void Create_RejectsExpiryOnOrBeforeEffectiveDate()
    {
        var act = () => Policy.Create(
            "PCL-000002", "Jane Tan", LineOfBusiness.Property, PolicyStatus.Active,
            10_000m, Currency.SGD,
            new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 1),
            Region.Singapore, "John Underwriter");

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_DefaultsFlaggedForReviewToFalse()
    {
        ValidPolicy().FlaggedForReview.Should().BeFalse();
    }

    [Fact]
    public void Flag_SetsFlaggedForReviewAndBumpsUpdatedAt()
    {
        var policy = ValidPolicy();
        var before = policy.UpdatedAt;

        policy.Flag();

        policy.FlaggedForReview.Should().BeTrue();
        policy.UpdatedAt.Should().BeOnOrAfter(before);
    }

    [Fact]
    public void ExtendExpiryTo_RejectsDateOnOrBeforeEffectiveDate()
    {
        var policy = ValidPolicy();
        var act = () => policy.ExtendExpiryTo(policy.EffectiveDate);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void ExtendExpiryTo_UpdatesExpiryDate()
    {
        var policy = ValidPolicy();
        var newExpiry = policy.ExpiryDate.AddDays(10);

        policy.ExtendExpiryTo(newExpiry);

        policy.ExpiryDate.Should().Be(newExpiry);
    }
}
