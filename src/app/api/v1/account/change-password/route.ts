/**
 * /api/v1/account/change-password  (customer)
 *   POST → change password (requires current). Bumps tokenVersion so other
 *          sessions are logged out; re-issues cookies for THIS device.
 */

import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { clientIp } from "@/core/rate-limit";
import { customerDeviceFingerprint, signCustomerAccessToken, signCustomerRefreshToken } from "@/core/customer-jwt";
import { requireCustomer, customerAuthService, changePasswordSchema } from "@/modules/customer-auth";
import { setCustomerCookies } from "@/modules/customer-auth/cookies";
import { sha256 } from "@/core/hash";
import { AppErrors } from "@/core/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);

  const body = await request.json().catch(() => null);
  const parsed = parse(changePasswordSchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const res = await customerAuthService.changePassword({
    customerId: guard.value.customerId,
    currentPassword: parsed.value.currentPassword,
    newPassword: parsed.value.newPassword,
  });
  if (!res.ok) return jsonError(res.error);

  // The service bumped tokenVersion → old tokens are now dead. Re-issue a
  // fresh pair for THIS device so the user stays signed in here.
  const hdrs = await headers();
  const fingerprint = await customerDeviceFingerprint(clientIp(hdrs), hdrs.get("user-agent") ?? "");
  const { connectMongoose } = await import("@/core/db/mongoose");
  const { CustomerModel } = await import("@/modules/customers/customer.model");
  await connectMongoose();
  const doc = await CustomerModel.findOne({ _id: guard.value.customerId }).select("+tokenVersion");
  if (!doc) return jsonError(AppErrors.unauthorized("Session expired"));
  const ver = doc.tokenVersion ?? 0;
  const accessToken = await signCustomerAccessToken({ sub: guard.value.customerId, ver, fp: fingerprint });
  const refreshToken = await signCustomerRefreshToken({ sub: guard.value.customerId, ver, fp: fingerprint });
  await CustomerModel.updateOne({ _id: doc._id }, { $set: { refreshTokenHash: await sha256(refreshToken) } });

  const out = jsonOk({ ok: true });
  setCustomerCookies(out, { accessToken, refreshToken });
  return out;
}
