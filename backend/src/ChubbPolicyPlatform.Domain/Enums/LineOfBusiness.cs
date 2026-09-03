namespace ChubbPolicyPlatform.Domain.Enums;

public enum LineOfBusiness
{
    Property,
    Casualty,
    AccidentAndHealth,
    Marine
}

/// <summary>
/// "A&amp;H" is not a valid C# identifier, so the wire/DB representation of
/// <see cref="LineOfBusiness.AccidentAndHealth"/> is mapped explicitly here rather than
/// relying on Enum.ToString(). Both the EF Core value converter and the API JSON
/// converter go through this single mapping so the two never drift apart.
/// </summary>
public static class LineOfBusinessExtensions
{
    public static string ToWireString(this LineOfBusiness value) => value switch
    {
        LineOfBusiness.Property => "Property",
        LineOfBusiness.Casualty => "Casualty",
        LineOfBusiness.AccidentAndHealth => "A&H",
        LineOfBusiness.Marine => "Marine",
        _ => throw new ArgumentOutOfRangeException(nameof(value), value, null)
    };

    public static LineOfBusiness FromWireString(string value) => value switch
    {
        "Property" => LineOfBusiness.Property,
        "Casualty" => LineOfBusiness.Casualty,
        "A&H" => LineOfBusiness.AccidentAndHealth,
        "Marine" => LineOfBusiness.Marine,
        _ => throw new ArgumentOutOfRangeException(nameof(value), value, "Unknown line of business")
    };
}
