/**
 * Admin auth domain — controller.
 * login (set access+refresh cookies) / refresh (rotate) / logout (clear) /
 * me / change-password.
 */

import { NextResponse, type NextRequest } from "next/server";
import { parse } from "@/core/validation";
import { jsonOk, jsonError } from "@/core/http";
import { env } from "@/core/config/env";
import { clientIp } from "@/core/rate-limit";
import { verifyToken } from "@/core/jwt";
import { userController } from "@/modules/users";
import { loginSchema } from "./admin-auth.schema";
import {
  adminAuthService,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  type IssuedTokens,
} from "./admin-auth.service";
import { requireAdmin } from "./guard";

const isProd = env.NODE_ENV === "production";

function baseCookie(maxAge: number) {
  return { httpOnly: true, secure: isProd, sameSite: "lax" as const, maxAge };
}

/** Set both session cookies on a response. Refresh is scoped to its route. */
function setTokenCookies(res: NextResponse, t: IssuedTokens) {
  res.cookies.set(ACCESS_COOKIE, t.accessToken, { ...baseCookie(t.accessMaxAge), path: "/" });
  // Refresh cookie: httpOnly + path "/" so it reliably reaches the refresh
  // endpoint. It's still only read by the refresh handler.
  res.cookies.set(REFRESH_COOKIE, t.refreshToken, { ...baseCookie(t.refreshMaxAge), path: "/" });
}

function clearTokenCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", { ...baseCookie(0), path: "/" });
  res.cookies.set(REFRESH_COOKIE, "", { ...baseCookie(0), path: "/" });
}

function reqCtx(request: NextRequest) {
  return { ip: clientIp(request.headers), userAgent: request.headers.get("user-agent") ?? "" };
}

export const adminAuthController = {
  async login(request: NextRequest, body: unknown) {
    const parsed = parse(loginSchema, body);
    if (!parsed.ok) return jsonError(parsed.error);

    const result = await adminAuthService.login(parsed.value.email, parsed.value.password, reqCtx(request));
    if (!result.ok) return jsonError(result.error);

    const res = jsonOk({ user: result.value.user, mustChangePassword: result.value.mustChangePassword });
    setTokenCookies(res, result.value.tokens);
    return res;
  },

  async refresh(request: NextRequest) {
    const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
    const result = await adminAuthService.refresh(refreshToken, reqCtx(request));
    if (!result.ok) {
      const res = jsonError(result.error);
      clearTokenCookies(res);
      return res;
    }
    const res = jsonOk({ refreshed: true });
    setTokenCookies(res, result.value.tokens);
    return res;
  },

  async logout(request: NextRequest) {
    // Clear the stored refresh token for this user (best-effort).
    const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
    const claims = await verifyToken(refreshToken, "refresh");
    if (claims) await adminAuthService.logout(claims.sub);
    const res = jsonOk({ loggedOut: true });
    clearTokenCookies(res);
    return res;
  },

  async me() {
    const guard = await requireAdmin();
    if (!guard.ok) return jsonError(guard.error);
    return jsonOk({ user: guard.value.session.user });
  },

  async changePassword(body: unknown) {
    const guard = await requireAdmin();
    if (!guard.ok) return jsonError(guard.error);
    return userController.changePassword(guard.value.session.user.id, body);
  },
};

export { NextResponse };
