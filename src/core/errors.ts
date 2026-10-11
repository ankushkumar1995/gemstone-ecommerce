/**
 * Typed application errors. Every failure in the system is one of these, each
 * carrying a stable `code` (for clients/i18n), an HTTP `status`, a safe
 * `message`, and optional structured `details` (e.g. validation issues).
 *
 * Services return these via `Result`; the HTTP layer maps them to responses.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface AppError {
  readonly code: ErrorCode;
  readonly status: number;
  readonly message: string;
  readonly details?: unknown;
}

function make(code: ErrorCode, status: number) {
  return (message: string, details?: unknown): AppError => ({
    code,
    status,
    message,
    details,
  });
}

/**
 * Factory for each error type. Usage:
 *   return fail(AppErrors.notFound("Lead not found"));
 */
export const AppErrors = {
  validation: make("VALIDATION_ERROR", 422),
  notFound: make("NOT_FOUND", 404),
  unauthorized: make("UNAUTHORIZED", 401),
  forbidden: make("FORBIDDEN", 403),
  conflict: make("CONFLICT", 409),
  rateLimited: make("RATE_LIMITED", 429),
  internal: make("INTERNAL_ERROR", 500),
} as const;

/** Type guard to detect our errors vs unknown thrown values. */
export function isAppError(e: unknown): e is AppError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    "status" in e &&
    "message" in e
  );
}

/** Normalise any thrown value into an AppError (last line of defence). */
export function toAppError(e: unknown): AppError {
  if (isAppError(e)) return e;
  const message = e instanceof Error ? e.message : "Something went wrong";
  return AppErrors.internal(message);
}
