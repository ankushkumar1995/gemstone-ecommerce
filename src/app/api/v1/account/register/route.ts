/**
 * /api/v1/account/register  (public; website + app)
 *   POST → create an email + password account and sign this device in.
 *   Rate-limited per IP to blunt mass sign-up abuse.
 */

import type { NextRequest } from "next/server";
import { jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { customerAuthService, registerSchema } from "@/modules/customer-auth";
import { authResponse, readCtx } from "@/modules/customer-auth/client-ctx";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ctx = readCtx(request);
  const rl = rateLimit(`account:register:${ctx.ip}`, { limit: 6, windowSeconds: 15 * 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited(`Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} min.`));

  const parsed = parse(registerSchema, await request.json().catch(() => null));
  if (!parsed.ok) return jsonError(parsed.error);

  const res = await customerAuthService.register({ ...parsed.value, ctx });
  if (!res.ok) return jsonError(res.error);
  return authResponse(ctx, { customer: res.value.customer }, res.value.tokens, 201);
}
