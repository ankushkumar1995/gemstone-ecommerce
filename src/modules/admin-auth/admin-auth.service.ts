/**
 * Admin auth domain — service.
 *
 * DEMO auth: a single hard-coded admin credential (configurable via env) and
 * a lightweight signed-ish session token stored in an httpOnly cookie. This
 * is deliberately simple for the mock phase; swap for NextAuth + hashed DB
 * users in a later phase without changing the admin UI.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import type { AdminUser, AdminSession } from "./admin-auth.types";

// Demo credentials (override with env in real setups).
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@nakshatra.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ?? "nakshatra-demo-secret";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

export const COOKIE_NAME = "nakshatra_admin_session";

const demoAdmin: AdminUser = {
  id: "admin_1",
  name: "Store Admin",
  email: ADMIN_EMAIL,
  role: "admin",
};

/** Encode a session into an opaque cookie value (demo). */
function encodeSession(session: AdminSession): string {
  const payload = JSON.stringify(session);
  const b64 = Buffer.from(payload).toString("base64url");
  // naive tamper-check: append a secret-salted length marker
  const sig = Buffer.from(`${SESSION_SECRET}:${b64.length}`).toString("base64url");
  return `${b64}.${sig}`;
}

/** Decode + validate a cookie value back into a session, or null. */
export function decodeSession(value: string | undefined): AdminSession | null {
  if (!value) return null;
  const [b64, sig] = value.split(".");
  if (!b64 || !sig) return null;
  const expected = Buffer.from(`${SESSION_SECRET}:${b64.length}`).toString("base64url");
  if (sig !== expected) return null;
  try {
    const session = JSON.parse(
      Buffer.from(b64, "base64url").toString()
    ) as AdminSession;
    if (!session.expiresAt || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export const adminAuthService = {
  login(email: string, password: string): Result<{ cookie: string; user: AdminUser }> {
    const emailOk = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const passOk = password === ADMIN_PASSWORD;
    if (!emailOk || !passOk) {
      return fail(AppErrors.unauthorized("Invalid email or password"));
    }
    const session: AdminSession = {
      user: demoAdmin,
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    return ok({ cookie: encodeSession(session), user: demoAdmin });
  },

  getSessionFromCookie(value: string | undefined): AdminSession | null {
    return decodeSession(value);
  },

  cookieMaxAgeSeconds: Math.floor(SESSION_TTL_MS / 1000),
};
