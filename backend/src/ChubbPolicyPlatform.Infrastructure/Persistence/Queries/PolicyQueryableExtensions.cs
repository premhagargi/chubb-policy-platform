using ChubbPolicyPlatform.Application.Common;
using ChubbPolicyPlatform.Application.Policies;
using ChubbPolicyPlatform.Domain.Entities;
using ChubbPolicyPlatform.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace ChubbPolicyPlatform.Infrastructure.Persistence.Queries;

/// <summary>
/// The filter/sort/search pipeline shared by GET /policies and GET /policies/summary.
/// Lives in Infrastructure (not Application) to keep the "Application never references
/// EF Core" boundary — ApplySort's Expression&lt;Func&lt;...&gt;&gt; usage pulls in EF Core.
/// Every step composes onto the same IQueryable so it all translates to one SQL
/// statement per call site (or runs as plain LINQ-to-Objects against the InMemory
/// provider); nothing here materializes the table.
/// </summary>
public static class PolicyQueryableExtensions
{
    public static IQueryable<Policy> ApplyFilters(this IQueryable<Policy> query, PolicyFilterRequest request)
    {
        if (request.Status is not null && Enum.TryParse<PolicyStatus>(request.Status, true, out var status))
            query = query.Where(p => p.Status == status);

        if (request.LineOfBusiness is not null)
        {
            var lob = LineOfBusinessExtensions.FromWireString(request.LineOfBusiness);
            query = query.Where(p => p.LineOfBusiness == lob);
        }

        if (request.Region is not null)
        {
            var region = RegionExtensions.FromWireString(request.Region);
            query = query.Where(p => p.Region == region);
        }

        if (request.EffectiveDateFrom is { } from)
            query = query.Where(p => p.EffectiveDate >= from);

        if (request.EffectiveDateTo is { } to)
            query = query.Where(p => p.EffectiveDate <= to);

        if (request.Flagged is { } flagged)
            query = query.Where(p => p.FlaggedForReview == flagged);

        return query;
    }

    public static IQueryable<Policy> ApplySearch(this IQueryable<Policy> query, string? search)
    {
        if (string.IsNullOrWhiteSpace(search))
            return query;

        // ToLower().Contains() instead of EF.Functions.ILike: translates on both Npgsql
        // (integration tests) and the InMemory provider (POC mode), where ILike has no
        // client-side implementation and throws at runtime.
        var term = search.Trim().ToLowerInvariant();
        return query.Where(p =>
            p.PolicyNumber.ToLower().Contains(term) ||
            p.PolicyholderName.ToLower().Contains(term) ||
            p.Underwriter.ToLower().Contains(term));
    }

    public static IQueryable<Policy> ApplySort(this IQueryable<Policy> query, SortSpec sort)
    {
        // Explicit whitelist map, never a dynamic-LINQ string-based OrderBy — avoids
        // reflection over arbitrary caller-supplied field names entirely.
        Expression<Func<Policy, object>> keySelector = sort.Field.ToLowerInvariant() switch
        {
            "policynumber" => p => p.PolicyNumber,
            "policyholdername" => p => p.PolicyholderName,
            "lineofbusiness" => p => p.LineOfBusiness,
            "status" => p => p.Status,
            "premiumamount" => p => p.PremiumAmount,
            "effectivedate" => p => p.EffectiveDate,
            "expirydate" => p => p.ExpiryDate,
            "region" => p => p.Region,
            "underwriter" => p => p.Underwriter,
            _ => p => p.CreatedAt
        };

        return sort.Descending ? query.OrderByDescending(keySelector) : query.OrderBy(keySelector);
    }
}
