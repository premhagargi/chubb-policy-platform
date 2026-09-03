using ChubbPolicyPlatform.Application.Policies;
using Microsoft.EntityFrameworkCore;

namespace ChubbPolicyPlatform.Infrastructure.Persistence.Commands;

public class PolicyCommandService(ApplicationDbContext db) : IPolicyCommandService
{
    public async Task<FlagPoliciesResult> FlagPoliciesAsync(FlagPoliciesRequest request, CancellationToken ct = default)
    {
        var matching = db.Policies.Where(p => request.PolicyIds.Contains(p.Id));

        // Determine which of the requested ids actually exist before the set-based
        // update, so the response can report exactly what happened (partial success is
        // a valid outcome per the documented contract, not an error).
        var matchedIds = await matching.Select(p => p.Id).ToListAsync(ct);

        if (matchedIds.Count > 0)
        {
            await matching.ExecuteUpdateAsync(setters => setters
                .SetProperty(p => p.FlaggedForReview, true)
                .SetProperty(p => p.UpdatedAt, DateTimeOffset.UtcNow), ct);
        }

        return new FlagPoliciesResult(matchedIds);
    }
}
