/**
 * /api/v1/account/forgot-password  (public)
 *   POST → start a password reset. Always responds success (no email
 *          enumeration). Rate-limited. The reset token is emailed once SMTP is
 *          configured; until then the service returns it for testing.
 */

import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { customerAuthService, forgotPasswordSchema } from "@/modules/customer-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  const rl = rateLimit(`account:forgot:${ip}`, { limit: 5, windowSeconds: 15 * 60 });
  if (!rl.allowed) {
    return jsonError(AppErrors.rateLimited(`Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} min.`));
  }

  const body = await request.json().catch(() => null);
  const parsed = parse(forgotPasswordSchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const res = await customerAuthService.forgotPassword(parsed.value.email);
  // Always generic success. (Token in res is for dev/testing until SMTP is live.)
  if (!res.ok) return jsonOk({ sent: true });
  return jsonOk({ sent: true });
}
