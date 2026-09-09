"""Single place exceptions become HTTP responses.

Every error - framework validation included - is rendered in the `ErrorResponse`
shape documented in openapi.yaml, and carries a `correlationId` that is also
logged, so a client-reported failure can be found in the server logs.

FastAPI's default for request-validation failures is 422; these handlers
normalise that to 400 to match the documented contract and the Angular error
interceptor, which was written against the previous .NET implementation.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.application.dto import ErrorResponse
from app.core.errors import AppError, ValidationError

logger = logging.getLogger(__name__)


def _response(
    *,
    status_code: int,
    title: str,
    correlation_id: uuid.UUID,
    errors: dict[str, list[str]] | None = None,
) -> JSONResponse:
    body = ErrorResponse(
        type=f"https://httpstatuses.io/{status_code}",
        title=title,
        status=status_code,
        correlation_id=correlation_id,
        errors=errors,
    )
    return JSONResponse(status_code=status_code, content=body.model_dump(mode="json", by_alias=True))


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        correlation_id = uuid.uuid4()
        errors = exc.errors if isinstance(exc, ValidationError) else None

        log = logger.error if exc.status_code >= 500 else logger.warning
        log(
            "Request failed.",
            extra={
                "correlation_id": str(correlation_id),
                "status": exc.status_code,
                "detail": exc.message,
            },
        )

        return _response(
            status_code=exc.status_code,
            title=exc.message if not errors else exc.title,
            correlation_id=correlation_id,
            errors=errors,
        )

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        correlation_id = uuid.uuid4()
        errors: dict[str, list[str]] = {}

        for error in exc.errors():
            # loc is ("body"|"query"|..., field, ...); drop the source segment so
            # the client sees the field name it sent.
            location = [str(part) for part in error["loc"][1:]] or [str(error["loc"][0])]
            errors.setdefault(".".join(location), []).append(error["msg"])

        logger.warning(
            "Request validation failed.",
            extra={"correlation_id": str(correlation_id), "errors": errors},
        )

        return _response(
            status_code=status.HTTP_400_BAD_REQUEST,
            title="One or more validation errors occurred.",
            correlation_id=correlation_id,
            errors=errors,
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _response(
            status_code=exc.status_code,
            title=str(exc.detail),
            correlation_id=uuid.uuid4(),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        correlation_id = uuid.uuid4()
        logger.exception(
            "Unhandled exception.",
            extra={"correlation_id": str(correlation_id)},
        )
        return _response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            title="An unexpected error occurred.",
            correlation_id=correlation_id,
        )
