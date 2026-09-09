using ChubbPolicyPlatform.Application.Policies;
using ChubbPolicyPlatform.Infrastructure.Caching;
using Microsoft.EntityFrameworkCore;

namespace ChubbPolicyPlatform.Infrastructure.Persistence.Commands;

public class PolicyCommandService(ApplicationDbContext db, PolicyCacheInvalidator cacheInvalidator) : IPolicyCommandService
{
    public async Task<FlagPoliciesResult> FlagPoliciesAsync(FlagPoliciesRequest request, CancellationToken ct = default)
    {
        // Load + mutate + SaveChanges instead of ExecuteUpdateAsync: the latter isn't
        // supported by the InMemory provider (POC mode), and this set is bounded by the
        // request's id list, so materializing it first is cheap.
        var matching = await db.Policies
            .Where(p => request.PolicyIds.Contains(p.Id))
            .ToListAsync(ct);

        foreach (var policy in matching)
            policy.Flag();

        if (matching.Count > 0)
        {
            await db.SaveChangesAsync(ct);

            // Evict the entire policy cache — flagging changes summary aggregations,
            // list contents for any filter that touches flagged state, etc.
            cacheInvalidator.InvalidateAll();
        }

        return new FlagPoliciesResult(matching.Select(p => p.Id).ToList());
    }
}
