using ChubbPolicyPlatform.Application.Common;
using ChubbPolicyPlatform.Application.Policies;
using ChubbPolicyPlatform.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace ChubbPolicyPlatform.Infrastructure.Persistence.Queries;

public class PolicyQueryService(ApplicationDbContext db) : IPolicyQueryService
{
    public async Task<PagedResult<PolicyDto>> GetPoliciesAsync(PolicyFilterRequest request, CancellationToken ct = default)
    {
        SortSpec.TryParse(request.Sort, out var sort); // validated upstream; falls back to default if not

        var filtered = db.Policies.AsNoTracking()
            .ApplyFilters(request)
            .ApplySearch(request.Search);

        var totalCount = await filtered.CountAsync(ct);

        var items = await filtered
            .ApplySort(sort)
            .Skip((request.Page - 1) * request.Size)
            .Take(request.Size)
            .ToListAsync(ct);

        return new PagedResult<PolicyDto>
        {
            Items = items.Select(p => p.ToDto()).ToList(),
            Page = request.Page,
            Size = request.Size,
            TotalCount = totalCount
        };
    }

    public async Task<PolicyDto?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var policy = await db.Policies.AsNoTracking().SingleOrDefaultAsync(p => p.Id == id, ct);
        return policy?.ToDto();
    }

    public async Task<PolicySummaryDto> GetSummaryAsync(PolicyFilterRequest request, CancellationToken ct = default)
    {
        var filtered = db.Policies.AsNoTracking()
            .ApplyFilters(request)
            .ApplySearch(request.Search);

        var statusCounts = await filtered
            .GroupBy(p => p.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var premiumByLob = await filtered
            .GroupBy(p => p.LineOfBusiness)
            .Select(g => new { LineOfBusiness = g.Key, Total = g.Sum(p => p.PremiumAmount) })
            .ToListAsync(ct);

        var regionCounts = await filtered
            .GroupBy(p => p.Region)
            .Select(g => new { Region = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var horizon = today.AddDays(30);
        var expiringSoonCount = await filtered.CountAsync(
            p => p.Status == PolicyStatus.Active && p.ExpiryDate >= today && p.ExpiryDate <= horizon, ct);

        var flaggedCount = await filtered.CountAsync(p => p.FlaggedForReview, ct);
        var totalCount = await filtered.CountAsync(ct);

        return new PolicySummaryDto(
            statusCounts.ToDictionary(x => x.Status.ToString(), x => x.Count),
            premiumByLob.ToDictionary(x => x.LineOfBusiness.ToWireString(), x => x.Total),
            expiringSoonCount,
            flaggedCount,
            totalCount,
            regionCounts.ToDictionary(x => x.Region.ToWireString(), x => x.Count));
    }
}
