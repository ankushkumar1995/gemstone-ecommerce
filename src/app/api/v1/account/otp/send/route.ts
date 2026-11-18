/**
 * POST /api/v1/account/otp/send  { phone }  (public; website + app)
 * Sends a 6-digit sign-in code. In demo mode (no SMS provider yet) the code is
 * returned as `demoCode` so the screen can show it.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, toResponse } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { otpService } from "@/modules/customer-auth/otp.service";
import { readCtx } from "@/modules/customer-auth/client-ctx";

export const dynamic = "force-dynamic";
const schema = z.object({ phone: z.string().trim().min(10).max(20) });

export async function POST(request: NextRequest) {
  const ctx = readCtx(request);
  // Fast per-instance guard; the real limits are durable inside otpService.
  const rl = rateLimit(`account:otp-send:${ctx.ip}`, { limit: 30, windowSeconds: 3600 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many codes requested. Please try again later."));
  const p = parse(schema, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  return toResponse(await otpService.send(p.value.phone, ctx));
}
