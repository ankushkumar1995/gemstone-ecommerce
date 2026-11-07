import "server-only";

/** Astrologer session cookies — httpOnly, secure in prod, sameSite=lax, separate names. */

import type { NextResponse } from "next/server";
import { env } from "@/core/config/env";
import { ASTRO_ACCESS_COOKIE, ASTRO_REFRESH_COOKIE, ASTRO_ACCESS_TTL_SECONDS, ASTRO_REFRESH_TTL_SECONDS } from "@/core/astrologer-jwt";
import type { AstroTokens } from "./astrologer-auth.service";

const base = (maxAge: number) => ({ httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax" as const, maxAge, path: "/" });

export function setAstroCookies(res: NextResponse, t: AstroTokens) {
  res.cookies.set(ASTRO_ACCESS_COOKIE, t.accessToken, base(ASTRO_ACCESS_TTL_SECONDS));
  res.cookies.set(ASTRO_REFRESH_COOKIE, t.refreshToken, base(ASTRO_REFRESH_TTL_SECONDS));
}
export function clearAstroCookies(res: NextResponse) {
  res.cookies.set(ASTRO_ACCESS_COOKIE, "", base(0));
  res.cookies.set(ASTRO_REFRESH_COOKIE, "", base(0));
}
