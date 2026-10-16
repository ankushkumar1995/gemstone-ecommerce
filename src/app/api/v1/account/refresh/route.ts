/**
 * /api/v1/account/refresh  (public — uses the refresh cookie)
 *   POST → verify the refresh token (version + device + reuse-detection),
 *          rotate it and set fresh cookies.
 */

import { cookies, headers } from "next/headers";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { clientIp } from "@/core/rate-limit";
import {
  verifyCustomerToken,
  customerDeviceFingerprint,
  CUSTOMER_REFRESH_COOKIE,
} from "@/core/customer-jwt";
import { customerAuthService } from "@/modules/customer-auth";
import { setCustomerCookies, clearCustomerCookies } from "@/modules/customer-auth/cookies";

export const dynamic = "force-dynamic";

export async function POST() {
  const [store, hdrs] = await Promise.all([cookies(), headers()]);
  const raw = store.get(CUSTOMER_REFRESH_COOKIE)?.value;
  const claims = await verifyCustomerToken(raw, "refresh");
  if (!claims || !raw) {
    const out = jsonError(AppErrors.unauthorized("Session expired"));
    clearCustomerCookies(out);
    return out;
  }

  const fingerprint = await customerDeviceFingerprint(clientIp(hdrs), hdrs.get("user-agent") ?? "");
  if (claims.fp && claims.fp !== fingerprint) {
    const out = jsonError(AppErrors.unauthorized("Session not valid on this device"));
    clearCustomerCookies(out);
    return out;
  }

  const res = await customerAuthService.refresh({
    customerId: claims.sub,
    tokenVersion: claims.ver,
    fingerprint,
    presentedRefresh: raw,
  });
  if (!res.ok) {
    const out = jsonError(res.error);
    clearCustomerCookies(out);
    return out;
  }

  const out = jsonOk({ customer: res.value.customer });
  setCustomerCookies(out, res.value.tokens);
  return out;
}
