import "server-only";

/** Small helpers shared by the astrologer API routes. */

import type { NextRequest } from "next/server";
import { clientIp, rateLimit } from "@/core/rate-limit";
import { astroDeviceFingerprint } from "@/core/astrologer-jwt";
import { AppErrors, type AppError } from "@/core/errors";

export async function fingerprintOf(request: NextRequest): Promise<string> {
  return astroDeviceFingerprint(clientIp(request.headers), request.headers.get("user-agent") ?? "");
}

/** Returns an error to send back when the caller is over the limit, else null. */
export function limit(request: NextRequest, key: string, max: number, windowSeconds: number): AppError | null {
  const rl = rateLimit(`${key}:${clientIp(request.headers)}`, { limit: max, windowSeconds });
  return rl.allowed ? null : AppErrors.rateLimited(`Too many requests. Try again in ${Math.max(1, Math.ceil(rl.retryAfter / 60))} min.`);
}

export async function body(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => null);
}
