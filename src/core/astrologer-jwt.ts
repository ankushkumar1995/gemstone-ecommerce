/**
 * JWT helpers for the ASTROLOGER session — a third, fully separate domain
 * (admin / customer / astrologer can never cross-use tokens):
 *   • own issuer + audience ("astrounkle-astrologer")
 *   • own domain-separated signing key (session secret + "::astrologer")
 *   • own cookies (astro_at / astro_rt)
 *
 * Same hardened model as the other two: short access (15 min) + rotating
 * refresh (30 d), `ver` = tokenVersion kill-switch, `fp` = device binding.
 * Edge-compatible (jose + Web Crypto) so the proxy can verify at the edge.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/core/config/env";

const ISSUER = "astrounkle-astrologer";
const AUDIENCE = "astrounkle-astrologer";

export const ASTRO_ACCESS_TTL_SECONDS = 15 * 60;
export const ASTRO_REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

export const ASTRO_ACCESS_COOKIE = "astro_at";
export const ASTRO_REFRESH_COOKIE = "astro_rt";

const DEV_FALLBACK = "astrounkle-dev-only-astrologer-secret-change-me-please-32+";

function secretKey(): Uint8Array {
  return new TextEncoder().encode((env.ADMIN_SESSION_SECRET || DEV_FALLBACK) + "::astrologer");
}

export type AstroTokenKind = "access" | "refresh";
export interface AstroTokenClaims {
  sub: string;
  ver: number;
  fp: string;
  kind: AstroTokenKind;
}

async function sign(c: AstroTokenClaims, ttl: number): Promise<string> {
  return new SignJWT({ ver: c.ver, fp: c.fp, kind: c.kind })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    // Unique id per token: without it, two tokens minted in the same second are
    // byte-identical, so a rotated-out refresh token would still match the new hash.
    .setJti(crypto.randomUUID())
    .setSubject(c.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secretKey());
}

export const signAstroAccessToken = (c: Omit<AstroTokenClaims, "kind">) => sign({ ...c, kind: "access" }, ASTRO_ACCESS_TTL_SECONDS);
export const signAstroRefreshToken = (c: Omit<AstroTokenClaims, "kind">) => sign({ ...c, kind: "refresh" }, ASTRO_REFRESH_TTL_SECONDS);

export async function verifyAstroToken(token: string | undefined, expected: AstroTokenKind): Promise<AstroTokenClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, audience: AUDIENCE });
    const p = payload as JWTPayload & { ver?: number; fp?: string; kind?: AstroTokenKind };
    if (!p.sub || p.kind !== expected) return null;
    return { sub: p.sub, ver: typeof p.ver === "number" ? p.ver : 0, fp: p.fp ?? "", kind: p.kind };
  } catch {
    return null;
  }
}

/** Device fingerprint — hash of IP + user-agent (same scheme as the other sessions). */
export async function astroDeviceFingerprint(ip: string, userAgent: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${userAgent}`));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
