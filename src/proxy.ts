/**
 * Edge proxy (Next.js 16 renamed `middleware` → `proxy`) — protects the admin
 * area at the edge.
 *
 * Verifies the session JWT's signature + expiry for every /admin/* route
 * (except the login page). A tampered or expired token is rejected and the
 * user is redirected to login. Full permission checks + live user status
 * happen server-side in `requireAdmin`; this is the fast first gate.
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from "@/core/jwt";

const ACCESS_COOKIE = "astrounkle_admin_session";
const REFRESH_COOKIE = "astrounkle_admin_refresh";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/admin/login";

  // Valid if the access token verifies, OR a refresh token exists (the client
  // can mint a new access token). The edge only checks signature/expiry; full
  // checks (tokenVersion, fingerprint, user status) happen in requireAdmin.
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const hasRefresh = Boolean(request.cookies.get(REFRESH_COOKIE)?.value);
  const claims = await verifyToken(accessToken, "access");
  const hasValidSession = Boolean(claims) || hasRefresh;

  // Not logged in → force to login.
  if (!isLogin && !hasValidSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Already logged in but visiting login → send to dashboard.
  if (isLogin && hasValidSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
