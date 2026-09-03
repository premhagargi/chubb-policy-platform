using ChubbPolicyPlatform.Application.Policies;
using FluentValidation.TestHelper;
using Xunit;

namespace ChubbPolicyPlatform.UnitTests.Application;

public class FlagPoliciesRequestValidatorTests
{
    private readonly FlagPoliciesRequestValidator _validator = new();

    [Fact]
    public void Valid_NonEmptyIds_HasNoErrors()
    {
        var result = _validator.TestValidate(new FlagPoliciesRequest(new[] { Guid.NewGuid() }));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_PolicyIds_IsInvalid()
    {
        var result = _validator.TestValidate(new FlagPoliciesRequest(Array.Empty<Guid>()));
        result.ShouldHaveValidationErrorFor(x => x.PolicyIds);
    }

    [Fact]
    public void PolicyIds_ContainingEmptyGuid_IsInvalid()
    {
        var result = _validator.TestValidate(new FlagPoliciesRequest(new[] { Guid.Empty }));
        result.ShouldHaveValidationErrorFor(x => x.PolicyIds);
    }

    [Fact]
    public void PolicyIds_ExceedingFiveHundred_IsInvalid()
    {
        var ids = Enumerable.Range(0, 501).Select(_ => Guid.NewGuid()).ToArray();
        var result = _validator.TestValidate(new FlagPoliciesRequest(ids));
        result.ShouldHaveValidationErrorFor(x => x.PolicyIds);
    }
}
