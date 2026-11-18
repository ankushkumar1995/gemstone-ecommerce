/**
 * POST /api/v1/account/otp/verify  { phone, code }  (public; website + app)
 * Signs this device in (creating the account if the number is new).
 * Response: { customer, isNew } (+ tokens for the app; cookies for the web).
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { otpService } from "@/modules/customer-auth/otp.service";
import { authResponse, readCtx } from "@/modules/customer-auth/client-ctx";
import { astroProfileService } from "@/modules/astro-profiles";

export const dynamic = "force-dynamic";
const schema = z.object({ phone: z.string().trim().min(10).max(20), code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") });

export async function POST(request: NextRequest) {
  const ctx = readCtx(request);
  const rl = rateLimit(`account:otp-verify:${ctx.ip}`, { limit: 40, windowSeconds: 15 * 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many attempts. Please try again later."));
  const p = parse(schema, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  const r = await otpService.verify(p.value.phone, p.value.code, ctx);
  if (!r.ok) return jsonError(r.error);
  // A brand-new account cannot have one yet; skip the lookup.
  const astroProfile = r.value.isNew ? null : await astroProfileService.forResponse(r.value.customer.id);
  return authResponse(ctx, { customer: r.value.customer, isNew: r.value.isNew, astroProfile }, r.value.tokens);
}
