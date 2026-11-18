/**
 * /api/v1/account/change-password  (customer; website + app)
 *   POST → change password (requires current). Every device is signed out
 *          (tokenVersion bump + sessions revoked); THIS device gets a fresh
 *          session so the customer stays signed in here.
 */

import type { NextRequest } from "next/server";
import { jsonError } from "@/core/http";
import { parse } from "@/core/validation";
import { requireCustomer, customerAuthService, changePasswordSchema } from "@/modules/customer-auth";
import { sessionService } from "@/modules/customer-auth/session.service";
import { authResponse, readCtx } from "@/modules/customer-auth/client-ctx";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);

  const parsed = parse(changePasswordSchema, await request.json().catch(() => null));
  if (!parsed.ok) return jsonError(parsed.error);

  const res = await customerAuthService.changePassword({
    customerId: guard.value.customerId,
    currentPassword: parsed.value.currentPassword,
    newPassword: parsed.value.newPassword,
  });
  if (!res.ok) return jsonError(res.error);

  const ctx = readCtx(request);
  const tokens = await sessionService.create(guard.value.customerId, ctx);
  return authResponse(ctx, { ok: true }, tokens);
}
