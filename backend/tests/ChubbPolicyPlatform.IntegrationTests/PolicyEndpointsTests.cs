using System.Net;
using System.Net.Http.Json;
using ChubbPolicyPlatform.Api.Middleware;
using ChubbPolicyPlatform.Application.Common;
using ChubbPolicyPlatform.Application.Policies;
using FluentAssertions;
using Xunit;

namespace ChubbPolicyPlatform.IntegrationTests;

public class PolicyEndpointsTests(PolicyApiFixture fixture) : IClassFixture<PolicyApiFixture>
{
    private readonly HttpClient _client = fixture.CreateClient();

    [Fact]
    public async Task GetPolicies_Default_ReturnsSeededPageWithExpectedShape()
    {
        var result = await _client.GetFromJsonAsync<PagedResult<PolicyDto>>("/api/v1/policies");

        result.Should().NotBeNull();
        result!.Page.Should().Be(1);
        result.Size.Should().Be(20);
        result.Items.Should().HaveCount(20);
        result.TotalCount.Should().BeGreaterThanOrEqualTo(220); // seeded floor
    }

    [Fact]
    public async Task GetPolicies_FilterByStatus_ReturnsOnlyThatStatus()
    {
        var result = await _client.GetFromJsonAsync<PagedResult<PolicyDto>>("/api/v1/policies?status=Active&size=50");

        result!.Items.Should().OnlyContain(p => p.Status == "Active");
    }

    [Fact]
    public async Task GetPolicies_FilterSortSearchCombined_AppliesAllTogether()
    {
        var result = await _client.GetFromJsonAsync<PagedResult<PolicyDto>>(
            "/api/v1/policies?lineOfBusiness=Marine&sort=premiumAmount,desc&size=100");

        result!.Items.Should().OnlyContain(p => p.LineOfBusiness == "Marine");
        result.Items.Select(p => p.PremiumAmount).Should().BeInDescendingOrder();
    }

    [Fact]
    public async Task GetPolicies_Search_MatchesPolicyNumber()
    {
        var seeded = await _client.GetFromJsonAsync<PagedResult<PolicyDto>>("/api/v1/policies?size=1");
        var target = seeded!.Items.Single().PolicyNumber;

        var result = await _client.GetFromJsonAsync<PagedResult<PolicyDto>>($"/api/v1/policies?search={target}");

        result!.Items.Should().ContainSingle(p => p.PolicyNumber == target);
    }

    [Fact]
    public async Task GetPolicies_InvalidSize_Returns400WithErrorShape()
    {
        var response = await _client.GetAsync("/api/v1/policies?size=0");

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var error = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        error!.Status.Should().Be(400);
        error.CorrelationId.Should().NotBeEmpty();
        error.Errors.Should().ContainKey("Size");
    }

    [Fact]
    public async Task GetPolicyById_UnknownId_Returns404()
    {
        var response = await _client.GetAsync($"/api/v1/policies/{Guid.NewGuid()}");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetPolicyById_KnownId_ReturnsMatchingPolicy()
    {
        var seeded = await _client.GetFromJsonAsync<PagedResult<PolicyDto>>("/api/v1/policies?size=1");
        var expected = seeded!.Items.Single();

        var policy = await _client.GetFromJsonAsync<PolicyDto>($"/api/v1/policies/{expected.Id}");

        policy!.PolicyNumber.Should().Be(expected.PolicyNumber);
    }

    [Fact]
    public async Task FlagPolicies_MixOfRealAndFakeIds_FlagsOnlyRealOnesAndPersists()
    {
        var seeded = await _client.GetFromJsonAsync<PagedResult<PolicyDto>>("/api/v1/policies?size=2&page=5");
        var realIds = seeded!.Items.Select(p => p.Id).ToArray();
        var fakeId = Guid.NewGuid();

        var response = await _client.PatchAsJsonAsync("/api/v1/policies/flag",
            new FlagPoliciesRequest(realIds.Append(fakeId).ToArray()));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<FlagPoliciesResult>();
        result!.FlaggedPolicyIds.Should().BeEquivalentTo(realIds);
        result.FlaggedCount.Should().Be(realIds.Length);

        var reloaded = await _client.GetFromJsonAsync<PolicyDto>($"/api/v1/policies/{realIds[0]}");
        reloaded!.FlaggedForReview.Should().BeTrue();
    }

    [Fact]
    public async Task FlagPolicies_EmptyList_Returns400()
    {
        var response = await _client.PatchAsJsonAsync("/api/v1/policies/flag", new FlagPoliciesRequest(Array.Empty<Guid>()));
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetSummary_CountsByStatusSumToTotal()
    {
        var summary = await _client.GetFromJsonAsync<PolicySummaryDto>("/api/v1/policies/summary");
        var total = await _client.GetFromJsonAsync<PagedResult<PolicyDto>>("/api/v1/policies?size=1");

        summary!.CountsByStatus.Values.Sum().Should().Be(total!.TotalCount);
        summary.PremiumByLineOfBusiness.Should().NotBeEmpty();
        summary.ExpiringSoonCount.Should().BeGreaterThan(0); // seeder guarantees ~15 expiring-soon records
    }
}
