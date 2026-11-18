import "server-only";

/**
 * Who is calling: the website or the mobile app, and from which device.
 *
 *  • App: sends headers  X-Client: android|ios, X-Device-Id: <uuid from SecureStore>,
 *         X-App-Version, X-Device-Name. Tokens travel in the JSON body / Bearer header.
 *  • Web: no X-Client header. A random device id lives in an httpOnly cookie
 *         (cust_did) so each browser is one session. Tokens travel in httpOnly cookies.
 */

import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { jsonOk } from "@/core/http";
import { env } from "@/core/config/env";
import { clientIp } from "@/core/rate-limit";
import { CUSTOMER_ACCESS_COOKIE, CUSTOMER_REFRESH_COOKIE, CUSTOMER_ACCESS_TTL_SECONDS, CUSTOMER_REFRESH_TTL_SECONDS } from "@/core/customer-jwt";
import { deviceLabel, type ClientKind, type SessionCtx, type SessionTokens } from "./session.service";

export const DEVICE_COOKIE = "cust_did";
const DEVICE_RE = /^[A-Za-z0-9_-]{8,100}$/;
const isProd = env.NODE_ENV === "production";
const cookieBase = (maxAge: number) => ({ httpOnly: true, secure: isProd, sameSite: "lax" as const, maxAge, path: "/" });

export function readCtx(request: NextRequest): SessionCtx & { newDeviceCookie: string | null } {
  const h = request.headers;
  const raw = (h.get("x-client") ?? "").toLowerCase();
  const client: ClientKind = raw === "android" || raw === "ios" ? raw : "web";
  const ip = clientIp(h);
  if (client !== "web") {
    const id = h.get("x-device-id") ?? "";
    return {
      client,
      deviceId: DEVICE_RE.test(id) ? id : `anon-${randomUUID()}`,
      deviceName: (h.get("x-device-name") ?? "").slice(0, 120) || (client === "android" ? "Android phone" : "iPhone"),
      appVersion: (h.get("x-app-version") ?? "").slice(0, 30),
      ip,
      newDeviceCookie: null,
    };
  }
  const existing = request.cookies.get(DEVICE_COOKIE)?.value ?? "";
  const deviceId = DEVICE_RE.test(existing) ? existing : randomUUID().replace(/-/g, "");
  return {
    client, deviceId, ip,
    deviceName: deviceLabel(h.get("user-agent") ?? ""),
    newDeviceCookie: deviceId === existing ? null : deviceId,
  };
}

/**
 * Successful sign-in / refresh response.
 *  • web → tokens in httpOnly cookies, body has only the customer
 *  • app → tokens in the body (the app keeps the refresh token in SecureStore)
 */
export function authResponse<T>(ctx: ReturnType<typeof readCtx>, data: T, tokens: SessionTokens, status = 200): NextResponse {
  if (ctx.client === "web") {
    const out = jsonOk(data, status);
    out.cookies.set(CUSTOMER_ACCESS_COOKIE, tokens.accessToken, cookieBase(CUSTOMER_ACCESS_TTL_SECONDS));
    out.cookies.set(CUSTOMER_REFRESH_COOKIE, tokens.refreshToken, cookieBase(CUSTOMER_REFRESH_TTL_SECONDS));
    if (ctx.newDeviceCookie) out.cookies.set(DEVICE_COOKIE, ctx.newDeviceCookie, cookieBase(400 * 86400));
    return out;
  }
  return jsonOk({ ...data, tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn } }, status);
}

/** Bearer token from the Authorization header (app), if any. */
export function bearer(h: Headers): string | undefined {
  const a = h.get("authorization") ?? "";
  return a.toLowerCase().startsWith("bearer ") ? a.slice(7).trim() : undefined;
}
