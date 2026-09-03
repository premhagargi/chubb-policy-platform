using FluentValidation;

namespace ChubbPolicyPlatform.Application.Policies;

public class FlagPoliciesRequestValidator : AbstractValidator<FlagPoliciesRequest>
{
    public FlagPoliciesRequestValidator()
    {
        RuleFor(x => x.PolicyIds)
            .NotEmpty().WithMessage("policyIds must contain at least one id.")
            .Must(ids => ids.Count <= 500).WithMessage("policyIds must not exceed 500 entries.")
            .Must(ids => ids.All(id => id != Guid.Empty)).WithMessage("policyIds must not contain an empty guid.");
    }
}
