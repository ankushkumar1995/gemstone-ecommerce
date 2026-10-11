/**
 * Standard HTTP response envelope for the API layer.
 *
 * Every endpoint returns the same shape so clients can rely on it:
 *   success → { success: true,  data: T }
 *   failure → { success: false, error: { code, message, details? } }
 *
 * `toResponse` turns a service `Result<T>` into a NextResponse, and
 * `handle` wraps a controller call so unexpected throws become clean 500s.
 */

import { NextResponse } from "next/server";
import type { Result } from "./result";
import { toAppError, type AppError } from "./errors";

export interface ApiSuccess<T> {
  success: true;
  data: T;
}
export interface ApiFailure {
  success: false;
  error: {
    code: AppError["code"];
    message: string;
    details?: unknown;
  };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function jsonOk<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function jsonError(error: AppError): NextResponse<ApiFailure> {
  return NextResponse.json(
    {
      success: false,
      error: { code: error.code, message: error.message, details: error.details },
    },
    { status: error.status }
  );
}

/** Map a service Result into a NextResponse. */
export function toResponse<T>(
  result: Result<T>,
  successStatus = 200
): NextResponse<ApiResponse<T>> {
  return result.ok
    ? jsonOk(result.value, successStatus)
    : jsonError(result.error);
}

/**
 * Wrap an async controller handler so any unexpected throw is converted into
 * a safe 500 envelope instead of crashing the route.
 */
export async function handle<T>(
  fn: () => Promise<NextResponse<ApiResponse<T>>>
): Promise<NextResponse<ApiResponse<T>>> {
  try {
    return await fn();
  } catch (e) {
    return jsonError(toAppError(e));
  }
}
