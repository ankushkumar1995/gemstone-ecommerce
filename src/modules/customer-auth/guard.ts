import "server-only";

/**
 * Server-side CUSTOMER guard — the security boundary for every customer API
 * (/api/v1/account/*, checkout, bookings, wallet…). Works for both clients:
 *
 *  • Mobile app → `Authorization: Bearer <access token>`
 *  • Website    → httpOnly access cookie
 *
 * Session tokens (with `sid`) are checked against their customer_sessions row
 * (revoked / expired / tokenVersion / blocked), cached ~30 s. Tokens issued
 * before sessions existed still work until they expire (≤ 15 min), using the
 * old device-fingerprint check.
 *
 *   const guard = await requireCustomer();
 *   if (!guard.ok) return jsonError(guard.error);
 *   const { customerId, sessionId } = guard.value;
 */

import { cookies, headers } from "next/headers";
import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { clientIp } from "@/core/rate-limit";
import { verifyCustomerToken, customerDeviceFingerprint, CUSTOMER_ACCESS_COOKIE } from "@/core/customer-jwt";
import { sessionService } from "./session.service";

function bearerOf(h: Headers): string | undefined {
  const a = h.get("authorization") ?? "";
  return a.toLowerCase().startsWith("bearer ") ? a.slice(7).trim() : undefined;
}

export async function requireCustomer(): Promise<Result<{ customerId: string; sessionId?: string }>> {
  const [store, hdrs] = await Promise.all([cookies(), headers()]);
  const token = bearerOf(hdrs) ?? store.get(CUSTOMER_ACCESS_COOKIE)?.value;
  const claims = await verifyCustomerToken(token, "access");
  if (!claims) return fail(AppErrors.unauthorized("Please sign in to continue"));

  if (claims.sid) {
    const state = await sessionService.check(claims.sid, claims.sub, claims.ver);
    if (state === "blocked") return fail(AppErrors.forbidden("This account has been disabled."));
    if (state !== "ok") return fail(AppErrors.unauthorized("Session expired. Please sign in again."));
    return ok({ customerId: claims.sub, sessionId: claims.sid });
  }

  // ---- legacy access token (pre-sessions, lives at most 15 minutes) ----
  const fp = await customerDeviceFingerprint(clientIp(hdrs), hdrs.get("user-agent") ?? "");
  if (claims.fp && claims.fp !== fp) return fail(AppErrors.unauthorized("Session not valid on this device"));
  const { connectMongoose } = await import("@/core/db/mongoose");
  const { CustomerModel } = await import("@/modules/customers/customer.model");
  await connectMongoose();
  const doc = await CustomerModel.findOne({ _id: claims.sub, isDeleted: { $ne: true } }).select("+tokenVersion status").lean();
  if (!doc) return fail(AppErrors.unauthorized("Session expired"));
  if (doc.status === "blocked") return fail(AppErrors.forbidden("This account has been disabled."));
  if ((doc.tokenVersion ?? 0) !== claims.ver) return fail(AppErrors.unauthorized("Session expired. Please sign in again."));
  return ok({ customerId: String(doc._id) });
}
