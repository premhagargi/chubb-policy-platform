import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export interface ApiError {
  status: number;
  title: string;
  correlationId?: string;
  errors?: Record<string, string[]>;
}

/** Normalizes every failed request into an ApiError shape so components never need to
 * know whether the backend spoke ProblemDetails-style JSON or the request never reached
 * it at all (network failure). */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((response: HttpErrorResponse) => {
      const apiError: ApiError =
        response.error && typeof response.error === 'object' && 'title' in response.error
          ? (response.error as ApiError)
          : { status: response.status, title: response.message || 'Request failed' };

      return throwError(() => apiError);
    })
  );
