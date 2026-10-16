import "server-only";

/**
 * Customer session cookie helpers — httpOnly, secure in prod, sameSite=lax.
 * Separate names (cust_at / cust_rt) from the admin cookies.
 */

import type { NextResponse } from "next/server";
import { env } from "@/core/config/env";
import {
  CUSTOMER_ACCESS_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
  CUSTOMER_ACCESS_TTL_SECONDS,
  CUSTOMER_REFRESH_TTL_SECONDS,
} from "@/core/customer-jwt";
import type { AuthTokens } from "./customer-auth.service";

const isProd = env.NODE_ENV === "production";

function base(maxAge: number) {
  return { httpOnly: true, secure: isProd, sameSite: "lax" as const, maxAge, path: "/" };
}

export function setCustomerCookies(res: NextResponse, tokens: AuthTokens) {
  res.cookies.set(CUSTOMER_ACCESS_COOKIE, tokens.accessToken, base(CUSTOMER_ACCESS_TTL_SECONDS));
  res.cookies.set(CUSTOMER_REFRESH_COOKIE, tokens.refreshToken, base(CUSTOMER_REFRESH_TTL_SECONDS));
}

export function clearCustomerCookies(res: NextResponse) {
  res.cookies.set(CUSTOMER_ACCESS_COOKIE, "", base(0));
  res.cookies.set(CUSTOMER_REFRESH_COOKIE, "", base(0));
}
