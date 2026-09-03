namespace ChubbPolicyPlatform.Domain.Enums;

public enum Region
{
    Singapore,
    HongKong,
    Australia,
    Japan,
    Thailand,
    Indonesia,
    Malaysia,
    Philippines
}

/// <summary>
/// "Hong Kong" contains a space and is not a valid C# identifier, so the wire/DB
/// representation is mapped explicitly here (same rationale as LineOfBusinessExtensions).
/// </summary>
public static class RegionExtensions
{
    public static string ToWireString(this Region value) => value switch
    {
        Region.HongKong => "Hong Kong",
        _ => value.ToString()
    };

    public static Region FromWireString(string value) => value switch
    {
        "Hong Kong" => Region.HongKong,
        _ => Enum.Parse<Region>(value)
    };
}
