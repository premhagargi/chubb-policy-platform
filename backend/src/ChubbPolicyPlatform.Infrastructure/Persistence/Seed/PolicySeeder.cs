using Bogus;
using ChubbPolicyPlatform.Domain.Entities;
using ChubbPolicyPlatform.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChubbPolicyPlatform.Infrastructure.Persistence.Seed;

public static class PolicySeeder
{
    private const int TargetTotal = 220;
    private static readonly Region[] AllRegions = Enum.GetValues<Region>();
    private static readonly LineOfBusiness[] AllLinesOfBusiness = Enum.GetValues<LineOfBusiness>();
    private static readonly PolicyStatus[] AllStatuses = Enum.GetValues<PolicyStatus>();

    public static async Task SeedAsync(ApplicationDbContext context, ILogger logger, CancellationToken ct = default)
    {
        if (await context.Policies.AnyAsync(ct))
        {
            logger.LogInformation("Policies table already has data — skipping seed.");
            return;
        }

        logger.LogInformation("Seeding {Count} policies...", TargetTotal);

        // Fixed seed: docker-compose up produces the same data every time, not a fresh
        // random set on every restart.
        var randomizer = new Randomizer(20260503);
        Randomizer.Seed = new Random(20260503);

        var policies = new List<Policy>();
        var policyNumberSuffix = 100000;

        // Deterministic sweep: guarantee every (status x lineOfBusiness x region)
        // combination is represented at least once before random-filling the rest.
        foreach (var status in AllStatuses)
        foreach (var lob in AllLinesOfBusiness)
        foreach (var region in AllRegions)
        {
            policies.Add(BuildPolicy(status, lob, region, policyNumberSuffix++, randomizer));
        }

        var faker = new Faker { Random = randomizer };
        while (policies.Count < TargetTotal)
        {
            var status = faker.PickRandom(AllStatuses);
            var lob = faker.PickRandom(AllLinesOfBusiness);
            var region = faker.PickRandom(AllRegions);
            policies.Add(BuildPolicy(status, lob, region, policyNumberSuffix++, randomizer, faker));
        }

        // Deliberately push a handful of Active policies into an "expiring soon" window
        // so GET /policies/summary's expiringSoonCount is non-trivial to verify.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        foreach (var policy in policies.Where(p => p.Status == PolicyStatus.Active).Take(15))
        {
            SetExpiringSoon(policy, today, randomizer);
        }

        // Pre-flag a handful of records so the dashboard isn't empty of flags on first load.
        foreach (var policy in policies.Take(10))
        {
            policy.Flag();
        }

        await context.Policies.AddRangeAsync(policies, ct);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Seeded {Count} policies.", policies.Count);
    }

    private static Policy BuildPolicy(
        PolicyStatus status, LineOfBusiness lob, Region region, int suffix, Randomizer randomizer, Faker? faker = null)
    {
        faker ??= new Faker { Random = randomizer };

        var policyNumber = $"PCL-{suffix:D6}";
        var policyholderName = faker.Name.FullName();
        var underwriter = faker.Name.FullName();
        var currency = MapCurrency(region);

        // Weighted-low premium: sample twice, take the min, so most policies are modest
        // with some large commercial outliers rather than a flat uniform distribution.
        var premium = Math.Min(
            randomizer.Decimal(1_000, 5_000_000),
            randomizer.Decimal(1_000, 5_000_000));

        var effectiveDate = DateOnly.FromDateTime(faker.Date.Past(2));
        var expiryDate = effectiveDate.AddYears(1);

        return Policy.Create(
            policyNumber, policyholderName, lob, status,
            Math.Round(premium, 2), currency, effectiveDate, expiryDate, region, underwriter);
    }

    private static void SetExpiringSoon(Policy policy, DateOnly today, Randomizer randomizer)
        => policy.ExtendExpiryTo(today.AddDays(randomizer.Int(1, 30)));

    private static Currency MapCurrency(Region region) => region switch
    {
        Region.Singapore => Currency.SGD,
        Region.HongKong => Currency.HKD,
        Region.Australia => Currency.AUD,
        Region.Japan => Currency.JPY,
        Region.Thailand => Currency.THB,
        _ => Currency.USD
    };
}
