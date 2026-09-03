using ChubbPolicyPlatform.Application.Common;
using FluentAssertions;
using Xunit;

namespace ChubbPolicyPlatform.UnitTests.Application;

public class SortSpecTests
{
    [Fact]
    public void TryParse_NullOrEmpty_ReturnsDefault()
    {
        SortSpec.TryParse(null, out var sort).Should().BeTrue();
        sort.Should().Be(SortSpec.Default);
    }

    [Theory]
    [InlineData("premiumAmount,desc", "premiumAmount", true)]
    [InlineData("premiumAmount,asc", "premiumAmount", false)]
    [InlineData("premiumAmount", "premiumAmount", false)]
    [InlineData("PolicyNumber,DESC", "PolicyNumber", true)]
    public void TryParse_ValidField_ParsesFieldAndDirection(string raw, string expectedField, bool expectedDescending)
    {
        var result = SortSpec.TryParse(raw, out var sort);

        result.Should().BeTrue();
        sort.Field.Should().Be(expectedField);
        sort.Descending.Should().Be(expectedDescending);
    }

    [Fact]
    public void TryParse_UnknownField_ReturnsFalseAndFallsBackToDefault()
    {
        var result = SortSpec.TryParse("notARealField,desc", out var sort);

        result.Should().BeFalse();
        sort.Should().Be(SortSpec.Default);
    }
}
