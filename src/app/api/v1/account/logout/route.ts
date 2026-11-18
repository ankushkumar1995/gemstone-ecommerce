/**
 * /api/v1/account/logout  (customer; website + app)
 *   POST            → sign out THIS device only (other devices stay signed in)
 *   POST ?all=1     → sign out every device
 */

import type { NextRequest } from "next/server";
import { jsonOk } from "@/core/http";
import { verifyCustomerToken, CUSTOMER_ACCESS_COOKIE } from "@/core/customer-jwt";
import { customerAuthService } from "@/modules/customer-auth";
import { clearCustomerCookies } from "@/modules/customer-auth/cookies";
import { bearer } from "@/modules/customer-auth/client-ctx";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = bearer(request.headers) ?? request.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value;
  const claims = await verifyCustomerToken(token, "access");
  if (claims) {
    if (request.nextUrl.searchParams.get("all") === "1") await customerAuthService.logoutAll(claims.sub);
    else await customerAuthService.logout(claims.sid, claims.sub);
  }
  // Always succeed, so a client with an expired token can still clean up.
  const out = jsonOk({ ok: true });
  clearCustomerCookies(out);
  return out;
}
