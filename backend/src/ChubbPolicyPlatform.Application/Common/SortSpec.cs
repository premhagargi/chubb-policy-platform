namespace ChubbPolicyPlatform.Application.Common;

public record SortSpec(string Field, bool Descending)
{
    /// <summary>
    /// Fields allowed in a `sort` query parameter. Kept in one place so the validator
    /// (Application) and the actual OrderBy expression map (Infrastructure) can never
    /// drift apart — both reference this list rather than each hard-coding their own.
    /// </summary>
    public static readonly IReadOnlySet<string> AllowedFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "policyNumber", "policyholderName", "lineOfBusiness", "status",
        "premiumAmount", "effectiveDate", "expiryDate", "region", "underwriter", "createdAt"
    };

    public static readonly SortSpec Default = new("createdAt", Descending: true);

    public static bool TryParse(string? raw, out SortSpec sortSpec)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            sortSpec = Default;
            return true;
        }

        var parts = raw.Split(',', StringSplitOptions.TrimEntries);
        var field = parts[0];
        var descending = parts.Length > 1 && parts[1].Equals("desc", StringComparison.OrdinalIgnoreCase);

        if (!AllowedFields.Contains(field))
        {
            sortSpec = Default;
            return false;
        }

        sortSpec = new SortSpec(field, descending);
        return true;
    }
}
