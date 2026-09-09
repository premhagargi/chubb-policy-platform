using Microsoft.Extensions.Caching.Memory;

namespace ChubbPolicyPlatform.Infrastructure.Caching;

/// <summary>
/// Singleton that manages a <see cref="CancellationTokenSource"/> shared by every
/// policy-related cache entry.  Calling <see cref="InvalidateAll"/> cancels the current
/// token (which triggers eviction on all entries registered with it) and replaces it
/// with a fresh one so new entries can attach to the next generation.
/// </summary>
public sealed class PolicyCacheInvalidator
{
    private readonly object _lock = new();
    private CancellationTokenSource _cts = new();

    /// <summary>Returns the current eviction token. Cache entries should register this
    /// via <see cref="MemoryCacheEntryOptions.AddExpirationToken"/>.</summary>
    public CancellationChangeToken GetChangeToken()
    {
        lock (_lock)
        {
            return new CancellationChangeToken(_cts.Token);
        }
    }

    /// <summary>Evicts every cache entry that was registered with the current token,
    /// then creates a fresh token for subsequent entries.</summary>
    public void InvalidateAll()
    {
        lock (_lock)
        {
            _cts.Cancel();
            _cts.Dispose();
            _cts = new CancellationTokenSource();
        }
    }
}
