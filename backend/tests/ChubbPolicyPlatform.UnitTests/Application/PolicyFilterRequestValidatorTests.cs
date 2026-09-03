using ChubbPolicyPlatform.Application.Policies;
using FluentAssertions;
using FluentValidation.TestHelper;
using Xunit;

namespace ChubbPolicyPlatform.UnitTests.Application;

public class PolicyFilterRequestValidatorTests
{
    private readonly PolicyFilterRequestValidator _validator = new();

    [Fact]
    public void Valid_DefaultRequest_HasNoErrors()
    {
        var result = _validator.TestValidate(new PolicyFilterRequest());
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Page_LessThanOne_IsInvalid(int page)
    {
        var result = _validator.TestValidate(new PolicyFilterRequest { Page = page });
        result.ShouldHaveValidationErrorFor(x => x.Page);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    public void Size_OutsideOneToOneHundred_IsInvalid(int size)
    {
        var result = _validator.TestValidate(new PolicyFilterRequest { Size = size });
        result.ShouldHaveValidationErrorFor(x => x.Size);
    }

    [Fact]
    public void Sort_UnknownField_IsInvalid()
    {
        var result = _validator.TestValidate(new PolicyFilterRequest { Sort = "notAField,desc" });
        result.ShouldHaveValidationErrorFor(x => x.Sort);
    }

    [Fact]
    public void Status_InvalidEnumString_IsInvalid()
    {
        var result = _validator.TestValidate(new PolicyFilterRequest { Status = "NotAStatus" });
        result.ShouldHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public void LineOfBusiness_AcceptsAmpersandForm()
    {
        var result = _validator.TestValidate(new PolicyFilterRequest { LineOfBusiness = "A&H" });
        result.ShouldNotHaveValidationErrorFor(x => x.LineOfBusiness);
    }

    [Fact]
    public void Region_InvalidValue_IsInvalid()
    {
        var result = _validator.TestValidate(new PolicyFilterRequest { Region = "Atlantis" });
        result.ShouldHaveValidationErrorFor(x => x.Region);
    }

    [Fact]
    public void EffectiveDateFrom_AfterEffectiveDateTo_IsInvalid()
    {
        var request = new PolicyFilterRequest
        {
            EffectiveDateFrom = new DateOnly(2026, 6, 1),
            EffectiveDateTo = new DateOnly(2026, 1, 1)
        };

        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.EffectiveDateFrom);
    }

    [Fact]
    public void Search_TooLong_IsInvalid()
    {
        var result = _validator.TestValidate(new PolicyFilterRequest { Search = new string('a', 201) });
        result.ShouldHaveValidationErrorFor(x => x.Search);
    }
}
