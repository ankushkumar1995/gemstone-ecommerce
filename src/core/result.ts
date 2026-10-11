/**
 * Result<T> — a typed success/failure wrapper used across all services and
 * repositories so the data layer never throws unexpectedly. Callers inspect
 * `.ok` and get fully-typed access to either `.value` or `.error`.
 *
 * This keeps business logic predictable and makes it trivial to map failures
 * to HTTP responses at the edge (see `core/http.ts`).
 */

import type { AppError } from "./errors";

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AppError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T = never>(error: AppError): Result<T> {
  return { ok: false, error };
}

/** Narrowing helpers (handy in tests and controllers). */
export function isOk<T>(r: Result<T>): r is { ok: true; value: T } {
  return r.ok;
}

export function isFail<T>(r: Result<T>): r is { ok: false; error: AppError } {
  return !r.ok;
}

/** Transform the success value while preserving a failure. */
export function mapResult<T, U>(r: Result<T>, fn: (value: T) => U): Result<U> {
  return r.ok ? ok(fn(r.value)) : r;
}
