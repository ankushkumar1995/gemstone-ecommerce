import "server-only";

/**
 * Server-side CUSTOMER guard — the security boundary for storefront account
 * APIs (/api/v1/account/*). Reads the customer access cookie, verifies the
 * JWT, re-checks the token version + device fingerprint against the DB (so a
 * revoked/blocked account or a stolen token is rejected immediately), and
 * returns the customer id.
 *
 *   const guard = await requireCustomer();
 *   if (!guard.ok) return jsonError(guard.error);
 *   const { customerId } = guard.value;
 */

import { cookies, headers } from "next/headers";
import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { clientIp } from "@/core/rate-limit";
import {
  verifyCustomerToken,
  customerDeviceFingerprint,
  CUSTOMER_ACCESS_COOKIE,
} from "@/core/customer-jwt";

export async function requireCustomer(): Promise<Result<{ customerId: string }>> {
  const [store, hdrs] = await Promise.all([cookies(), headers()]);
  const token = store.get(CUSTOMER_ACCESS_COOKIE)?.value;
  const claims = await verifyCustomerToken(token, "access");
  if (!claims) return fail(AppErrors.unauthorized("Please sign in to continue"));

  // Device-binding: the token must have been issued to THIS device.
  const fp = await customerDeviceFingerprint(clientIp(hdrs), hdrs.get("user-agent") ?? "");
  if (claims.fp && claims.fp !== fp) {
    return fail(AppErrors.unauthorized("Session not valid on this device"));
  }

  // Fresh check: token version + account status (kill-switch / blocked).
  const { connectMongoose } = await import("@/core/db/mongoose");
  const { CustomerModel } = await import("@/modules/customers/customer.model");
  await connectMongoose();
  const doc = await CustomerModel.findOne({ _id: claims.sub, isDeleted: { $ne: true } })
    .select("+tokenVersion status")
    .lean();
  if (!doc) return fail(AppErrors.unauthorized("Session expired"));
  if (doc.status === "blocked") return fail(AppErrors.forbidden("This account has been disabled."));
  if ((doc.tokenVersion ?? 0) !== claims.ver) {
    return fail(AppErrors.unauthorized("Session expired. Please sign in again."));
  }

  return ok({ customerId: String(doc._id) });
}
