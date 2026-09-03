using ChubbPolicyPlatform.Application.Common;
using ChubbPolicyPlatform.Application.Policies;
using ChubbPolicyPlatform.Domain.Entities;
using ChubbPolicyPlatform.Domain.Enums;
using ChubbPolicyPlatform.Infrastructure.Persistence.Queries;
using FluentAssertions;
using Xunit;

namespace ChubbPolicyPlatform.UnitTests.Infrastructure;

// ApplyFilters/ApplySort are plain LINQ over IQueryable and translate identically
// whether the source is EF Core or an in-memory list, so they're testable here without
// a database. ApplySearch (EF.Functions.ILike) has no client-side implementation and is
// covered by the Postgres-backed integration tests instead.
public class PolicyQueryableExtensionsTests
{
    private static Policy Build(PolicyStatus status, LineOfBusiness lob, Region region, decimal premium, DateOnly effectiveDate, string policyNumber = "PCL-000001") =>
        Policy.Create(policyNumber, "Test Holder", lob, status, premium, Currency.USD,
            effectiveDate, effectiveDate.AddYears(1), region, "Test Underwriter");

    private static readonly IQueryable<Policy> Sample = new[]
    {
        Build(PolicyStatus.Active, LineOfBusiness.Property, Region.Singapore, 10_000m, new DateOnly(2026, 1, 1), "PCL-000001"),
        Build(PolicyStatus.Expired, LineOfBusiness.Marine, Region.Japan, 50_000m, new DateOnly(2025, 6, 1), "PCL-000002"),
        Build(PolicyStatus.Active, LineOfBusiness.Casualty, Region.Australia, 20_000m, new DateOnly(2026, 3, 1), "PCL-000003"),
    }.AsQueryable();

    [Fact]
    public void ApplyFilters_ByStatus_ReturnsOnlyMatchingStatus()
    {
        var result = Sample.ApplyFilters(new PolicyFilterRequest { Status = "Active" }).ToList();
        result.Should().HaveCount(2).And.OnlyContain(p => p.Status == PolicyStatus.Active);
    }

    [Fact]
    public void ApplyFilters_ByLineOfBusiness_ReturnsOnlyMatchingLine()
    {
        var result = Sample.ApplyFilters(new PolicyFilterRequest { LineOfBusiness = "Marine" }).ToList();
        result.Should().ContainSingle().Which.LineOfBusiness.Should().Be(LineOfBusiness.Marine);
    }

    [Fact]
    public void ApplyFilters_ByRegion_ReturnsOnlyMatchingRegion()
    {
        var result = Sample.ApplyFilters(new PolicyFilterRequest { Region = "Australia" }).ToList();
        result.Should().ContainSingle().Which.Region.Should().Be(Region.Australia);
    }

    [Fact]
    public void ApplyFilters_ByEffectiveDateRange_ExcludesOutsideRange()
    {
        var result = Sample.ApplyFilters(new PolicyFilterRequest
        {
            EffectiveDateFrom = new DateOnly(2026, 1, 1),
            EffectiveDateTo = new DateOnly(2026, 12, 31)
        }).ToList();

        result.Should().HaveCount(2).And.OnlyContain(p => p.EffectiveDate.Year == 2026);
    }

    [Fact]
    public void ApplyFilters_CombinesMultipleFilters()
    {
        var result = Sample.ApplyFilters(new PolicyFilterRequest { Status = "Active", LineOfBusiness = "Property" }).ToList();
        result.Should().ContainSingle().Which.PolicyNumber.Should().Be("PCL-000001");
    }

    [Fact]
    public void ApplySort_ByPremiumAmountDescending_OrdersHighestFirst()
    {
        var result = Sample.ApplySort(new SortSpec("premiumAmount", Descending: true)).ToList();
        result.Select(p => p.PremiumAmount).Should().BeInDescendingOrder();
    }

    [Fact]
    public void ApplySort_ByPolicyNumberAscending_OrdersAlphabetically()
    {
        var result = Sample.ApplySort(new SortSpec("policyNumber", Descending: false)).ToList();
        result.Select(p => p.PolicyNumber).Should().BeInAscendingOrder();
    }
}
