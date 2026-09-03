using ChubbPolicyPlatform.Application.Common;
using ChubbPolicyPlatform.Application.Policies;
using ChubbPolicyPlatform.Domain.Entities;
using ChubbPolicyPlatform.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace ChubbPolicyPlatform.Infrastructure.Persistence.Queries;

/// <summary>
/// The filter/sort/search pipeline shared by GET /policies and GET /policies/summary.
/// Lives in Infrastructure (not Application) because ApplySearch needs
/// EF.Functions.ILike, which pulls in an EF Core dependency — keeping that out of
/// Application preserves the "Application never references EF Core" boundary. Every
/// step composes onto the same IQueryable so it all translates to one SQL statement per
/// call site; nothing here materializes the table.
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

        return query;
    }

    public static IQueryable<Policy> ApplySearch(this IQueryable<Policy> query, string? search)
    {
        if (string.IsNullOrWhiteSpace(search))
            return query;

        var term = $"%{search.Trim()}%";
        return query.Where(p =>
            EF.Functions.ILike(p.PolicyNumber, term) ||
            EF.Functions.ILike(p.PolicyholderName, term) ||
            EF.Functions.ILike(p.Underwriter, term));
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
