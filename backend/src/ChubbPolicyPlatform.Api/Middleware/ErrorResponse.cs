namespace ChubbPolicyPlatform.Api.Middleware;

public record ErrorResponse(
    string Type,
    string Title,
    int Status,
    Guid CorrelationId,
    IReadOnlyDictionary<string, string[]>? Errors = null);
