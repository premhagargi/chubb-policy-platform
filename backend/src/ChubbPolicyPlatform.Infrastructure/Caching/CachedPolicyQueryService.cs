using ChubbPolicyPlatform.Application.Common;
using ChubbPolicyPlatform.Application.Policies;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace ChubbPolicyPlatform.Infrastructure.Caching;

/// <summary>
/// Decorator around <see cref="IPolicyQueryService"/> that caches list and summary
/// responses in <see cref="IMemoryCache"/>.  Single-entity lookups are not cached
/// (already fast, and caching would complicate post-mutation drawer freshness).
///
/// Every entry is registered with the <see cref="PolicyCacheInvalidator"/>'s current
/// change token, so calling <see cref="PolicyCacheInvalidator.InvalidateAll"/> after a
/// mutation instantly evicts the entire policy cache.
/// </summary>
public class CachedPolicyQueryService(
    IPolicyQueryService inner,
    IMemoryCache cache,
    PolicyCacheInvalidator invalidator,
    ILogger<CachedPolicyQueryService> logger) : IPolicyQueryService
{
    private static readonly TimeSpan ListTtl = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan SummaryTtl = TimeSpan.FromSeconds(60);

    public async Task<PagedResult<PolicyDto>> GetPoliciesAsync(PolicyFilterRequest request, CancellationToken ct = default)
    {
        var key = BuildListKey(request);

        if (cache.TryGetValue(key, out PagedResult<PolicyDto>? cached) && cached is not null)
        {
            logger.LogDebug("Cache HIT for policy list: {Key}", key);
            return cached;
        }

        logger.LogDebug("Cache MISS for policy list: {Key}", key);
        var result = await inner.GetPoliciesAsync(request, ct);

        var options = new MemoryCacheEntryOptions()
            .SetSlidingExpiration(ListTtl)
            .AddExpirationToken(invalidator.GetChangeToken());

        cache.Set(key, result, options);
        return result;
    }

    public Task<PolicyDto?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        // Not cached — single-row lookup is already fast, and caching would
        // complicate drawer freshness after flag mutations.
        return inner.GetByIdAsync(id, ct);
    }

    public async Task<PolicySummaryDto> GetSummaryAsync(PolicyFilterRequest request, CancellationToken ct = default)
    {
        var key = BuildSummaryKey(request);

        if (cache.TryGetValue(key, out PolicySummaryDto? cached) && cached is not null)
        {
            logger.LogDebug("Cache HIT for policy summary: {Key}", key);
            return cached;
        }

        logger.LogDebug("Cache MISS for policy summary: {Key}", key);
        var result = await inner.GetSummaryAsync(request, ct);

        var options = new MemoryCacheEntryOptions()
            .SetSlidingExpiration(SummaryTtl)
            .AddExpirationToken(invalidator.GetChangeToken());

        cache.Set(key, result, options);
        return result;
    }

    // ----- Key builders -----

    /// <summary>Deterministic key including all filter + paging fields.</summary>
    private static string BuildListKey(PolicyFilterRequest r)
        => $"policies:p={r.Page}&s={r.Size}&sort={r.Sort}&status={r.Status}&lob={r.LineOfBusiness}" +
           $"&region={r.Region}&from={r.EffectiveDateFrom}&to={r.EffectiveDateTo}" +
           $"&search={r.Search}&flagged={r.Flagged}";

    /// <summary>Deterministic key for summary — excludes Page/Size/Sort since the
    /// summary endpoint ignores paging.</summary>
    private static string BuildSummaryKey(PolicyFilterRequest r)
        => $"summary:status={r.Status}&lob={r.LineOfBusiness}" +
           $"&region={r.Region}&from={r.EffectiveDateFrom}&to={r.EffectiveDateTo}" +
           $"&search={r.Search}&flagged={r.Flagged}";
}
