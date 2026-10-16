/**
 * JWT helpers for the admin session — sign + verify with `jose` (HS256).
 *
 * Two token kinds (high-security session model):
 *   • ACCESS  — short-lived (15 min). Sent on every request. Carries user id,
 *     role, token version `ver`, and a device fingerprint `fp`.
 *   • REFRESH — long-lived (days). Used only to mint a new access token when it
 *     expires. Rotated on every use; its hash is stored on the user.
 *
 * Edge-compatible (no Node-only APIs) so the proxy can verify at the edge.
 * The payload is base64 (readable) but TAMPER-PROOF via the signature — never
 * put secrets in it. `ver` + `fp` are the anti-theft levers:
 *   - `ver` must match the user's current tokenVersion (bump = kill all tokens)
 *   - `fp` must match the request's device fingerprint (stolen-token guard)
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/core/config/env";

const ISSUER = "astrounkle-admin";
const AUDIENCE = "astrounkle-admin";

export const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/** Dev-only fallback secret (production hard-fails without a real one in env). */
const DEV_FALLBACK = "astrounkle-dev-only-session-secret-change-me-please-32+";

function secretKey(): Uint8Array {
  const raw = env.ADMIN_SESSION_SECRET || DEV_FALLBACK;
  return new TextEncoder().encode(raw);
}

export type TokenKind = "access" | "refresh";

export interface AdminTokenClaims {
  /** user id (subject) */
  sub: string;
  /** role id (fast first-pass; real perms resolved from DB) */
  roleId: string;
  /** token version — must equal the user's tokenVersion or the token is dead */
  ver: number;
  /** device fingerprint (hash of ip + user-agent) — anti-theft binding */
  fp: string;
  /** which kind of token this is */
  kind: TokenKind;
}

async function sign(claims: AdminTokenClaims, ttlSeconds: number): Promise<string> {
  return new SignJWT({ roleId: claims.roleId, ver: claims.ver, fp: claims.fp, kind: claims.kind })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey());
}

export function signAccessToken(c: Omit<AdminTokenClaims, "kind">): Promise<string> {
  return sign({ ...c, kind: "access" }, ACCESS_TTL_SECONDS);
}

export function signRefreshToken(c: Omit<AdminTokenClaims, "kind">): Promise<string> {
  return sign({ ...c, kind: "refresh" }, REFRESH_TTL_SECONDS);
}

/** Verify + decode a token of the expected kind. Returns claims or null. */
export async function verifyToken(
  token: string | undefined,
  expectedKind: TokenKind,
): Promise<AdminTokenClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, audience: AUDIENCE });
    const p = payload as JWTPayload & { roleId?: string; ver?: number; fp?: string; kind?: TokenKind };
    if (!p.sub || !p.roleId || p.kind !== expectedKind) return null;
    return {
      sub: p.sub,
      roleId: p.roleId,
      ver: typeof p.ver === "number" ? p.ver : 0,
      fp: p.fp ?? "",
      kind: p.kind,
    };
  } catch {
    return null;
  }
}

/**
 * Device fingerprint — a stable hash of client IP + user-agent. Edge-safe
 * (Web Crypto). Used to bind a token to the device it was issued on.
 */
export async function deviceFingerprint(ip: string, userAgent: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}|${userAgent}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
