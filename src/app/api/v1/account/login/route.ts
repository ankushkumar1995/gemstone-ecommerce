/**
 * /api/v1/account/login  (public; website + app)
 *   POST { email, password } → signs this device in.
 *   Web: httpOnly cookies. App (X-Client: android|ios): tokens in the body.
 *   Rate-limited per IP + email; the per-account lockout is the deeper layer.
 */

import type { NextRequest } from "next/server";
import { jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { customerAuthService, loginSchema } from "@/modules/customer-auth";
import { authResponse, readCtx } from "@/modules/customer-auth/client-ctx";
import { astroProfileService } from "@/modules/astro-profiles";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const ctx = readCtx(request);
  const rl = rateLimit(`account:login:${ctx.ip}:${(body?.email ?? "").toLowerCase()}`, { limit: 8, windowSeconds: 15 * 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited(`Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} min.`));

  const parsed = parse(loginSchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const res = await customerAuthService.login({ ...parsed.value, ctx });
  if (!res.ok) return jsonError(res.error);
  const astroProfile = await astroProfileService.forResponse(res.value.customer.id);
  return authResponse(ctx, { customer: res.value.customer, astroProfile }, res.value.tokens);
}
