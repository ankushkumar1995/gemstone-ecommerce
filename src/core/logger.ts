/**
 * Structured logger.
 *
 * One logger for the whole backend. In development it prints readable,
 * colourless single-line logs; in production it emits JSON (one object per
 * line) so log aggregators (CloudWatch, Datadog, Loki…) can parse them.
 *
 * Every log can carry structured fields, and — when called inside a request —
 * the active request id is attached automatically (see request-context.ts) so
 * you can trace one request across many log lines.
 *
 * Never log secrets. Pass fields as an object; the logger shallow-redacts a
 * few well-known sensitive keys as a safety net.
 */

import { env } from "@/core/config/env";
import { getRequestId } from "@/core/request-context";

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Minimum level to emit. Debug is dropped in production. */
const MIN_LEVEL: Level = env.NODE_ENV === "production" ? "info" : "debug";

const REDACT_KEYS = new Set([
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "mongodb_uri",
  "aws_secret_access_key",
  "aws_access_key_secret",
]);

type Fields = Record<string, unknown>;

function redact(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? "***" : v;
  }
  return out;
}

function emit(level: Level, message: string, fields?: Fields) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  const requestId = getRequestId();
  const base = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...(requestId ? { requestId } : {}),
    ...(fields ? redact(fields) : {}),
  };

  if (env.NODE_ENV === "production") {
    // One JSON object per line.
    const line = JSON.stringify(base);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }

  // Dev: readable one-liner.
  const tag = `[${level.toUpperCase()}]`;
  const rid = requestId ? ` (${requestId.slice(0, 8)})` : "";
  const extra = fields && Object.keys(fields).length ? ` ${JSON.stringify(redact(fields))}` : "";
  const text = `${tag}${rid} ${message}${extra}`;
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

export const logger = {
  debug: (message: string, fields?: Fields) => emit("debug", message, fields),
  info: (message: string, fields?: Fields) => emit("info", message, fields),
  warn: (message: string, fields?: Fields) => emit("warn", message, fields),
  error: (message: string, fields?: Fields) => emit("error", message, fields),
};
