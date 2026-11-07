/**
 * Edge proxy (Next.js 16 renamed `middleware` → `proxy`) — the fast first gate
 * for the two signed-in back-offices:
 *
 *   • /admin/*       — admin session (except /admin/login)
 *   • /astrologer/*  — partner session (except login / apply / password pages)
 *
 * Only the JWT signature + expiry are checked here (or the presence of a
 * refresh cookie, so the client can mint a new access token). Full checks —
 * token version, device fingerprint, live account status, permissions —
 * happen server-side in `requireAdmin` / `requireAstrologer` on every API call.
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from "@/core/jwt";
import { verifyAstroToken, ASTRO_ACCESS_COOKIE, ASTRO_REFRESH_COOKIE } from "@/core/astrologer-jwt";

const ACCESS_COOKIE = "astrounkle_admin_session";
const REFRESH_COOKIE = "astrounkle_admin_refresh";

/** Partner pages reachable without a session. */
const ASTRO_PUBLIC = ["/astrologer/login", "/astrologer/apply", "/astrologer/forgot-password", "/astrologer/reset-password"];

function redirect(request: NextRequest, pathname: string, from?: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (from) url.searchParams.set("from", from);
  return NextResponse.redirect(url);
}

async function adminGate(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/admin/login";
  const claims = await verifyToken(request.cookies.get(ACCESS_COOKIE)?.value, "access");
  const hasValidSession = Boolean(claims) || Boolean(request.cookies.get(REFRESH_COOKIE)?.value);
  if (!isLogin && !hasValidSession) return redirect(request, "/admin/login", pathname);
  if (isLogin && hasValidSession) return redirect(request, "/admin");
  return NextResponse.next();
}

async function astrologerGate(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = ASTRO_PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const claims = await verifyAstroToken(request.cookies.get(ASTRO_ACCESS_COOKIE)?.value, "access");
  const hasValidSession = Boolean(claims) || Boolean(request.cookies.get(ASTRO_REFRESH_COOKIE)?.value);
  if (!isPublic && !hasValidSession) return redirect(request, "/astrologer/login", pathname);
  // Signed-in partners skip the login page (apply/reset stay reachable).
  if (pathname === "/astrologer/login" && hasValidSession) return redirect(request, "/astrologer");
  return NextResponse.next();
}

export async function proxy(request: NextRequest) {
  return request.nextUrl.pathname.startsWith("/astrologer") ? astrologerGate(request) : adminGate(request);
}

export const config = {
  matcher: ["/admin/:path*", "/astrologer/:path*"],
};
