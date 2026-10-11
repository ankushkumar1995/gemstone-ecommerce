/**
 * Admin auth domain — controller. Handles login (set cookie) and logout
 * (clear cookie), returning the standard API envelope.
 */

import { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { jsonOk, jsonError } from "@/core/http";
import { loginSchema } from "./admin-auth.schema";
import { adminAuthService, COOKIE_NAME } from "./admin-auth.service";

export const adminAuthController = {
  async login(body: unknown) {
    const parsed = parse(loginSchema, body);
    if (!parsed.ok) return jsonError(parsed.error);

    const result = adminAuthService.login(
      parsed.value.email,
      parsed.value.password
    );
    if (!result.ok) return jsonError(result.error);

    const res = jsonOk({ user: result.value.user });
    res.cookies.set(COOKIE_NAME, result.value.cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: adminAuthService.cookieMaxAgeSeconds,
    });
    return res;
  },

  async logout() {
    const res = jsonOk({ loggedOut: true });
    res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return res;
  },
};

export { NextResponse };
