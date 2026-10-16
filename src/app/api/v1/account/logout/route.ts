/**
 * /api/v1/account/logout  (customer)
 *   POST → clear the stored refresh hash + wipe cookies.
 */

import { cookies } from "next/headers";
import { jsonOk } from "@/core/http";
import { verifyCustomerToken, CUSTOMER_ACCESS_COOKIE } from "@/core/customer-jwt";
import { customerAuthService } from "@/modules/customer-auth";
import { clearCustomerCookies } from "@/modules/customer-auth/cookies";

export const dynamic = "force-dynamic";

export async function POST() {
  const store = await cookies();
  const claims = await verifyCustomerToken(store.get(CUSTOMER_ACCESS_COOKIE)?.value, "access");
  if (claims) await customerAuthService.logout(claims.sub);
  const out = jsonOk({ ok: true });
  clearCustomerCookies(out);
  return out;
}
