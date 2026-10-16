/**
 * JWT helpers for the CUSTOMER (storefront) session — fully separate from the
 * admin session so the two can never be cross-used:
 *   • Different issuer + audience ("astrounkle-customer") — an admin token
 *     will NOT verify here, and a customer token will NOT verify as admin.
 *   • Different cookies (cust_at / cust_rt) — see the account routes.
 *
 * Same high-security model as admin:
 *   • ACCESS  — short (15 min). Carries customer id, token version `ver`, and a
 *     device fingerprint `fp`.
 *   • REFRESH — long (30 d). Rotated on every use; its hash stored on the
 *     customer. `ver` must equal the customer's tokenVersion (bump = kill all).
 *
 * Edge-compatible (jose + Web Crypto only). Payload is readable but tamper-
 * proof via the signature — never put secrets in it.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/core/config/env";

const ISSUER = "astrounkle-customer";
const AUDIENCE = "astrounkle-customer";

export const CUSTOMER_ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
export const CUSTOMER_REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/** Dev-only fallback (production hard-fails without a real secret in env). */
const DEV_FALLBACK = "astrounkle-dev-only-customer-secret-change-me-please-32+";

function secretKey(): Uint8Array {
  // Reuse the session secret but DOMAIN-SEPARATE it so customer tokens are
  // keyed independently from admin tokens even with one env secret.
  const raw = (env.ADMIN_SESSION_SECRET || DEV_FALLBACK) + "::customer";
  return new TextEncoder().encode(raw);
}

export type CustomerTokenKind = "access" | "refresh";

export interface CustomerTokenClaims {
  /** customer id (subject) */
  sub: string;
  /** token version — must equal the customer's tokenVersion or the token is dead */
  ver: number;
  /** device fingerprint (hash of ip + user-agent) — anti-theft binding */
  fp: string;
  kind: CustomerTokenKind;
}

async function sign(claims: CustomerTokenClaims, ttlSeconds: number): Promise<string> {
  return new SignJWT({ ver: claims.ver, fp: claims.fp, kind: claims.kind })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey());
}

export function signCustomerAccessToken(c: Omit<CustomerTokenClaims, "kind">): Promise<string> {
  return sign({ ...c, kind: "access" }, CUSTOMER_ACCESS_TTL_SECONDS);
}

export function signCustomerRefreshToken(c: Omit<CustomerTokenClaims, "kind">): Promise<string> {
  return sign({ ...c, kind: "refresh" }, CUSTOMER_REFRESH_TTL_SECONDS);
}

/** Verify + decode a customer token of the expected kind. Returns claims or null. */
export async function verifyCustomerToken(
  token: string | undefined,
  expectedKind: CustomerTokenKind,
): Promise<CustomerTokenClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, audience: AUDIENCE });
    const p = payload as JWTPayload & { ver?: number; fp?: string; kind?: CustomerTokenKind };
    if (!p.sub || p.kind !== expectedKind) return null;
    return {
      sub: p.sub,
      ver: typeof p.ver === "number" ? p.ver : 0,
      fp: p.fp ?? "",
      kind: p.kind,
    };
  } catch {
    return null;
  }
}

/** Device fingerprint — stable hash of client IP + user-agent (Web Crypto). */
export async function customerDeviceFingerprint(ip: string, userAgent: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}|${userAgent}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/** Cookie names (httpOnly) for the customer session. */
export const CUSTOMER_ACCESS_COOKIE = "cust_at";
export const CUSTOMER_REFRESH_COOKIE = "cust_rt";
