using ChubbPolicyPlatform.Application.Common;
using ChubbPolicyPlatform.Domain.Enums;
using FluentValidation;

namespace ChubbPolicyPlatform.Application.Policies;

public class PolicyFilterRequestValidator : AbstractValidator<PolicyFilterRequest>
{
    public PolicyFilterRequestValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1);
        RuleFor(x => x.Size).InclusiveBetween(1, 100);

        RuleFor(x => x.Sort)
            .Must(sort => SortSpec.TryParse(sort, out _))
            .WithMessage($"sort must reference one of: {string.Join(", ", SortSpec.AllowedFields)}, optionally followed by \",asc\" or \",desc\".")
            .When(x => !string.IsNullOrWhiteSpace(x.Sort));

        RuleFor(x => x.Status)
            .Must(s => Enum.TryParse<PolicyStatus>(s, ignoreCase: true, out _))
            .WithMessage("status must be one of: Active, Expired, Pending, Cancelled.")
            .When(x => x.Status is not null);

        RuleFor(x => x.LineOfBusiness)
            .Must(lob => TryParseLineOfBusiness(lob!))
            .WithMessage("lineOfBusiness must be one of: Property, Casualty, A&H, Marine.")
            .When(x => x.LineOfBusiness is not null);

        RuleFor(x => x.Region)
            .Must(r => TryParseRegion(r!))
            .WithMessage("region must be one of: Singapore, Hong Kong, Australia, Japan, Thailand, Indonesia, Malaysia, Philippines.")
            .When(x => x.Region is not null);

        RuleFor(x => x)
            .Must(x => x.EffectiveDateFrom is null || x.EffectiveDateTo is null || x.EffectiveDateFrom <= x.EffectiveDateTo)
            .WithMessage("effectiveDateFrom must be on or before effectiveDateTo.")
            .WithName("effectiveDateFrom");

        RuleFor(x => x.Search).MaximumLength(200);
    }

    private static bool TryParseLineOfBusiness(string value)
    {
        try { LineOfBusinessExtensions.FromWireString(value); return true; }
        catch { return false; }
    }

    private static bool TryParseRegion(string value)
    {
        try { RegionExtensions.FromWireString(value); return true; }
        catch { return false; }
    }
}
