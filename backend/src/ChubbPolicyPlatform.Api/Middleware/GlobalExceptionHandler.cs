using ChubbPolicyPlatform.Domain.Exceptions;
using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace ChubbPolicyPlatform.Api.Middleware;

/// <summary>
/// Single place unhandled exceptions become an HTTP response, matching the
/// ErrorResponse shape documented in openapi.yaml. Every response carries a
/// correlationId that also appears in the Serilog scope for the same request, so a
/// client-reported error can be cross-referenced against server logs.
/// </summary>
public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken ct)
    {
        var correlationId = Guid.NewGuid();

        var (status, title, errors) = exception switch
        {
            ValidationException validationException => (
                StatusCodes.Status400BadRequest,
                "One or more validation errors occurred.",
                validationException.Errors
                    .GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())),

            PolicyNotFoundException => (StatusCodes.Status404NotFound, exception.Message, null),

            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred.", null)
        };

        if (status == StatusCodes.Status500InternalServerError)
        {
            logger.LogError(exception, "Unhandled exception. CorrelationId: {CorrelationId}", correlationId);
        }
        else
        {
            logger.LogWarning("Request failed with {Status}. CorrelationId: {CorrelationId}", status, correlationId);
        }

        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(new ErrorResponse(
            Type: $"https://httpstatuses.io/{status}",
            Title: title,
            Status: status,
            CorrelationId: correlationId,
            Errors: errors), cancellationToken: ct);

        return true;
    }
}
