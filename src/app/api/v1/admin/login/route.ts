/**
 * /api/v1/admin/login
 *   POST → verify credentials, set the session cookie. Rate-limited per IP+email
 *          to blunt brute-force (the per-account lockout is the deeper layer).
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { adminAuthController } from "@/modules/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = (await request.json().catch(() => null)) as { email?: string } | null;
    const ip = clientIp(request.headers);
    const key = `login:${ip}:${(body?.email ?? "").toLowerCase()}`;
    const rl = rateLimit(key, { limit: 8, windowSeconds: 15 * 60 });
    if (!rl.allowed) {
      return jsonError(AppErrors.rateLimited(`Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} min.`));
    }
    return adminAuthController.login(request, body);
  }, request);
}
