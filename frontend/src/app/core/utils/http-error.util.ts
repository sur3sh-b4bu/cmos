import { HttpErrorResponse } from '@angular/common/http';

/** Extracts the human-readable message our API always sends on error responses. */
export function extractErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { message?: string; details?: { field?: string; message?: string }[] } | null;
    if (body?.message) {
      if (body.details?.length) {
        const detail = body.details
          .map((d) => (d.field ? `${d.field}: ${d.message ?? 'invalid'}` : d.message))
          .filter(Boolean)
          .join(', ');
        return detail ? `${body.message} (${detail})` : body.message;
      }
      return body.message;
    }
    if (error.status === 0) return 'Cannot reach the server. Please check your connection.';
  }
  return fallback;
}
