"""Domain-independent API error types and their HTTP mapping.

Keeps the exact `ErrorResponse` wire shape the previous .NET
`GlobalExceptionHandler` produced (and that openapi.yaml documents), so the
Angular error interceptor did not need to change during the port.
"""

from __future__ import annotations


class AppError(Exception):
    """Base class for errors that map to a deliberate HTTP status."""

    status_code: int = 500
    title: str = "An unexpected error occurred."

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or self.title)
        self.message = message or self.title


class PolicyNotFoundError(AppError):
    status_code = 404
    title = "Policy not found."

    def __init__(self, policy_id: str) -> None:
        super().__init__(f"Policy '{policy_id}' was not found.")
        self.policy_id = policy_id


class ValidationError(AppError):
    """Raised for request state the framework cannot express declaratively
    (e.g. cross-field date ordering)."""

    status_code = 400
    title = "One or more validation errors occurred."

    def __init__(self, errors: dict[str, list[str]]) -> None:
        super().__init__(self.title)
        self.errors = errors


class LlmProviderError(AppError):
    """The upstream LLM call failed (network, auth, rate limit, timeout)."""

    status_code = 502
    title = "The AI provider could not complete the request."
