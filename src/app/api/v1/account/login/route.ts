/**
 * /api/v1/account/login  (public, storefront)
 *   POST → verify credentials, set httpOnly cookies. Rate-limited per IP+email
 *          (the per-account lockout after 5 fails is the deeper layer).
 */

import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { customerDeviceFingerprint } from "@/core/customer-jwt";
import { customerAuthService, loginSchema } from "@/modules/customer-auth";
import { setCustomerCookies } from "@/modules/customer-auth/cookies";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const ip = clientIp(request.headers);
  const rl = rateLimit(`account:login:${ip}:${(body?.email ?? "").toLowerCase()}`, {
    limit: 8,
    windowSeconds: 15 * 60,
  });
  if (!rl.allowed) {
    return jsonError(AppErrors.rateLimited(`Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} min.`));
  }

  const parsed = parse(loginSchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const fingerprint = await customerDeviceFingerprint(ip, request.headers.get("user-agent") ?? "");
  const res = await customerAuthService.login({ ...parsed.value, fingerprint });
  if (!res.ok) return jsonError(res.error);

  const out = jsonOk({ customer: res.value.customer });
  setCustomerCookies(out, res.value.tokens);
  return out;
}
