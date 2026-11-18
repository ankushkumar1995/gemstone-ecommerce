/**
 * /api/v1/account/refresh  (public)
 *   POST → rotate the refresh token, return a new pair.
 *   Web: refresh token from the httpOnly cookie, new tokens set as cookies.
 *   App: { refreshToken } in the body, new tokens in the body.
 * Old (pre-session) web cookies are migrated into a session here.
 */

import type { NextRequest } from "next/server";
import { jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit } from "@/core/rate-limit";
import { CUSTOMER_REFRESH_COOKIE } from "@/core/customer-jwt";
import { customerAuthService } from "@/modules/customer-auth";
import { clearCustomerCookies } from "@/modules/customer-auth/cookies";
import { authResponse, readCtx } from "@/modules/customer-auth/client-ctx";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ctx = readCtx(request);
  const rl = rateLimit(`account:refresh:${ctx.ip}`, { limit: 120, windowSeconds: 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many requests. Please slow down."));

  const body = ctx.client === "web" ? null : ((await request.json().catch(() => null)) as { refreshToken?: string } | null);
  const presented = ctx.client === "web" ? request.cookies.get(CUSTOMER_REFRESH_COOKIE)?.value : body?.refreshToken;

  const res = await customerAuthService.refresh(presented ?? "", ctx);
  if (!res.ok) {
    const out = jsonError(res.error);
    if (ctx.client === "web") clearCustomerCookies(out);
    return out;
  }
  return authResponse(ctx, { customer: res.value.customer }, res.value.tokens);
}
