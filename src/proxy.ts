/**
 * Edge proxy (Next.js 16 renamed `middleware` → `proxy`) — protects the admin
 * area.
 *
 * Any /admin/* route (except the login page) requires a valid admin session
 * cookie, otherwise the user is redirected to /admin/login. The cookie's
 * presence + expiry is checked here; full validation happens server-side.
 */

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME } from "@/modules/admin-auth/admin-auth.service";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isLogin = pathname === "/admin/login";
  const cookie = request.cookies.get(COOKIE_NAME)?.value;

  // lightweight presence + expiry check (edge-safe, no Buffer needed)
  const hasValidSession = isSessionCookieValid(cookie);

  // not logged in → force to login
  if (!isLogin && !hasValidSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // already logged in but visiting login → send to dashboard
  if (isLogin && hasValidSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/** Decode the base64url payload and check expiry (no secret check at edge). */
function isSessionCookieValid(value: string | undefined): boolean {
  if (!value) return false;
  const [b64] = value.split(".");
  if (!b64) return false;
  try {
    const json = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
    const session = JSON.parse(json) as { expiresAt?: number };
    return Boolean(session.expiresAt && session.expiresAt > Date.now());
  } catch {
    return false;
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
