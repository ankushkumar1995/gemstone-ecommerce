/**
 * /api/v1/account/reset-password  (public)
 *   POST → set a new password using a valid reset token. Bumps tokenVersion
 *          (all old sessions die). Rate-limited.
 */

import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { customerAuthService, resetPasswordSchema } from "@/modules/customer-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  const rl = rateLimit(`account:reset:${ip}`, { limit: 10, windowSeconds: 15 * 60 });
  if (!rl.allowed) {
    return jsonError(AppErrors.rateLimited(`Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} min.`));
  }

  const body = await request.json().catch(() => null);
  const parsed = parse(resetPasswordSchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const res = await customerAuthService.resetPassword(parsed.value);
  if (!res.ok) return jsonError(res.error);
  return jsonOk({ ok: true });
}
