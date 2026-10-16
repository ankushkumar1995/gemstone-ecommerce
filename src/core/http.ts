/**
 * Standard HTTP response envelope for the API layer.
 *
 * Every endpoint returns the same shape so clients can rely on it:
 *   success → { success: true,  data: T,     meta: { ms, at } }
 *   failure → { success: false, error: {...}, meta: { ms, at } }
 *
 * `meta.ms` is the server-side handling time in milliseconds, also surfaced
 * as the `X-Response-Time` header. `toResponse` turns a service `Result<T>`
 * into a NextResponse, and `handle` wraps a controller call so unexpected
 * throws become clean 500s AND every response is stamped with its timing.
 */

import { NextResponse } from "next/server";
import type { Result } from "./result";
import { toAppError, type AppError } from "./errors";
import { runWithContext, getContext } from "./request-context";
import { logger } from "./logger";

export interface ApiMeta {
  /** Server-side handling time in milliseconds. */
  ms: number;
  /** ISO timestamp when the response was produced. */
  at: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}
export interface ApiFailure {
  success: false;
  error: {
    code: AppError["code"];
    message: string;
    details?: unknown;
  };
  meta?: ApiMeta;
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
 * Stamp a response with timing: adds `meta: { ms, at }` to the JSON body and
 * an `X-Response-Time` header. Rebuilds the NextResponse because the body is
 * already serialized by this point.
 */
async function stampTiming<T>(
  res: NextResponse<ApiResponse<T>>,
  startedAt: number,
  requestId?: string,
): Promise<NextResponse<ApiResponse<T>>> {
  const ms = Math.round((performance.now() - startedAt) * 100) / 100;
  const meta: ApiMeta = { ms, at: new Date().toISOString() };

  const addHeaders = (r: NextResponse) => {
    r.headers.set("X-Response-Time", `${ms}ms`);
    r.headers.set("Server-Timing", `app;dur=${ms}`);
    if (requestId) r.headers.set("X-Request-Id", requestId);
  };

  // If the response carries cookies (auth login/logout), don't rebuild it —
  // rebuilding can drop Set-Cookie. Just stamp the timing headers.
  if (res.headers.has("set-cookie") || res.cookies.getAll().length > 0) {
    addHeaders(res);
    return res;
  }

  let body: ApiResponse<T>;
  try {
    body = (await res.clone().json()) as ApiResponse<T>;
  } catch {
    addHeaders(res);
    return res;
  }

  const stamped = NextResponse.json({ ...body, meta }, { status: res.status });
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() === "content-length") return; // body changed
    stamped.headers.set(key, value);
  });
  addHeaders(stamped);
  return stamped;
}

/**
 * Wrap an async controller handler so that every API call:
 *   • runs inside a request context (shared request id + start time)
 *   • converts unexpected throws into a safe 500 envelope
 *   • is stamped with handling time (meta.ms + X-Response-Time) and X-Request-Id
 *   • is logged once (method, path, status, ms) — error logs include the stack
 *
 * Pass the incoming `request` (optional) so an inbound `X-Request-Id` is reused
 * and the log carries method + path.
 */
export async function handle<T>(
  fn: () => Promise<NextResponse<ApiResponse<T>>>,
  request?: Request,
): Promise<NextResponse<ApiResponse<T>>> {
  const inboundId = request?.headers.get("x-request-id") ?? undefined;
  const method = request?.method;
  const path = request ? safePath(request.url) : undefined;

  return runWithContext({ requestId: inboundId, method, path }, async () => {
    const ctx = getContext();
    const startedAt = ctx?.startedAt ?? performance.now();
    const requestId = ctx?.requestId;

    try {
      const res = await fn();
      const stamped = await stampTiming(res, startedAt, requestId);
      logger.info("request", {
        method,
        path,
        status: stamped.status,
        ms: Math.round((performance.now() - startedAt) * 100) / 100,
      });
      return stamped;
    } catch (e) {
      const appErr = toAppError(e);
      const res = jsonError(appErr) as NextResponse<ApiResponse<T>>;
      const stamped = await stampTiming(res, startedAt, requestId);
      logger.error("request failed", {
        method,
        path,
        status: appErr.status,
        code: appErr.code,
        error: appErr.message,
        ms: Math.round((performance.now() - startedAt) * 100) / 100,
      });
      return stamped;
    }
  });
}

function safePath(url: string): string | undefined {
  try {
    return new URL(url).pathname;
  } catch {
    return undefined;
  }
}
