/**
 * /api/v1/account/register  (public, storefront)
 *   POST → create a customer account + auto-login (sets httpOnly cookies).
 *   Rate-limited per IP to blunt mass sign-up abuse.
 */

import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { customerDeviceFingerprint } from "@/core/customer-jwt";
import { customerAuthService, registerSchema } from "@/modules/customer-auth";
import { setCustomerCookies } from "@/modules/customer-auth/cookies";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  const rl = rateLimit(`account:register:${ip}`, { limit: 6, windowSeconds: 15 * 60 });
  if (!rl.allowed) {
    return jsonError(AppErrors.rateLimited(`Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} min.`));
  }

  const body = await request.json().catch(() => null);
  const parsed = parse(registerSchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const fingerprint = await customerDeviceFingerprint(ip, request.headers.get("user-agent") ?? "");
  const res = await customerAuthService.register({ ...parsed.value, fingerprint });
  if (!res.ok) return jsonError(res.error);

  const out = jsonOk({ customer: res.value.customer }, 201);
  setCustomerCookies(out, res.value.tokens);
  return out;
}
