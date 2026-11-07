import "server-only";

/**
 * Astrologer authentication — same hardened model as customer/admin auth:
 *   • bcrypt(12) hashes, generic "invalid email or password" (no enumeration)
 *   • lockout after 5 failures for 15 minutes
 *   • access 15m + refresh 30d; refresh ROTATED on use; a replayed old refresh
 *     (hash mismatch) bumps tokenVersion and kills every session
 *   • device fingerprint binding; suspended / removed accounts are rejected
 *   • password change / reset bump tokenVersion (logs out other devices)
 *   • reset tokens: 32 random bytes, only the SHA-256 is stored, 1 hour TTL,
 *     single use, delivered by email (returned in the API only outside prod)
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { env } from "@/core/config/env";
import { sha256 } from "@/core/hash";
import { hashPassword, verifyPassword, passwordIssue } from "@/core/password";
import { signAstroAccessToken, signAstroRefreshToken, verifyAstroToken } from "@/core/astrologer-jwt";
import { BRAND } from "@/lib/brand";
import { getAstrologerRepository } from "@/modules/astrologers/astrologer.repository";
import { mailPasswordReset } from "@/modules/astrologers/astrologer.emails";
import type { Astrologer } from "@/modules/astrologers/astrologer.types";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const DUMMY_HASH = "$2a$12$0000000000000000000000000000000000000000000000000000";

export interface AstroTokens { accessToken: string; refreshToken: string }
export interface AstroIdentity { id: string; displayName: string; email: string; status: Astrologer["status"]; mustChangePassword: boolean; photo?: string }

const identity = (a: Astrologer): AstroIdentity => ({ id: a.id, displayName: a.displayName, email: a.email, status: a.status, mustChangePassword: a.mustChangePassword, photo: a.photo });

/** Accounts that may hold a session (they can sign in to see status, fix KYC, etc.). */
const CAN_SIGN_IN: Astrologer["status"][] = ["applied", "under_review", "approved", "rejected", "deactivated"];

async function issue(id: string, ver: number, fp: string): Promise<AstroTokens> {
  const [accessToken, refreshToken] = await Promise.all([
    signAstroAccessToken({ sub: id, ver, fp }),
    signAstroRefreshToken({ sub: id, ver, fp }),
  ]);
  const repo = getAstrologerRepository();
  await repo.setAuth(id, { refreshTokenHash: await sha256(refreshToken) });
  await repo.update(id, { lastLoginAt: new Date().toISOString() });
  return { accessToken, refreshToken };
}

export const astrologerAuthService = {
  /** Issue tokens for a freshly created account (after apply). */
  async issueFor(id: string, fingerprint: string): Promise<AstroTokens> {
    const auth = await getAstrologerRepository().getAuth(id);
    return issue(id, auth?.tokenVersion ?? 0, fingerprint);
  },

  async login(email: string, password: string, fingerprint: string): Promise<Result<{ astrologer: AstroIdentity; tokens: AstroTokens }>> {
    const repo = getAstrologerRepository();
    const GENERIC = AppErrors.unauthorized("Invalid email or password");
    const a = await repo.findByEmail(email.trim().toLowerCase());
    if (!a) {
      await verifyPassword(password, DUMMY_HASH);
      return fail(GENERIC);
    }
    const auth = await repo.getAuth(a.id);
    if (!auth) return fail(GENERIC);
    if (auth.lockedUntil && auth.lockedUntil.getTime() > Date.now()) {
      return fail(AppErrors.forbidden(`Too many attempts. Try again in ${Math.ceil((auth.lockedUntil.getTime() - Date.now()) / 60000)} minute(s).`));
    }
    if (!(await verifyPassword(password, auth.passwordHash))) {
      const failed = auth.failedLoginCount + 1;
      await repo.setAuth(a.id, failed >= MAX_FAILED ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) } : { failedLoginCount: failed });
      return fail(GENERIC);
    }
    if (a.status === "suspended") return fail(AppErrors.forbidden(`Your account is suspended${a.statusReason ? `: ${a.statusReason}` : ""}. Contact support.`));
    if (!CAN_SIGN_IN.includes(a.status)) return fail(GENERIC);
    await repo.setAuth(a.id, { failedLoginCount: 0, lockedUntil: null });
    const tokens = await issue(a.id, auth.tokenVersion, fingerprint);
    return ok({ astrologer: identity(a), tokens });
  },

  async refresh(refreshToken: string | undefined, fingerprint: string): Promise<Result<{ astrologer: AstroIdentity; tokens: AstroTokens }>> {
    const claims = await verifyAstroToken(refreshToken, "refresh");
    if (!claims || !refreshToken) return fail(AppErrors.unauthorized("Session expired"));
    const repo = getAstrologerRepository();
    const [a, auth] = await Promise.all([repo.findById(claims.sub), repo.getAuth(claims.sub)]);
    if (!a || !auth) return fail(AppErrors.unauthorized("Session expired"));
    if (claims.ver !== auth.tokenVersion) return fail(AppErrors.unauthorized("Session expired"));
    if (claims.fp && claims.fp !== fingerprint) {
      await repo.bumpTokenVersion(a.id);
      return fail(AppErrors.unauthorized("Session blocked (device changed). Please sign in again."));
    }
    if (!auth.refreshTokenHash || auth.refreshTokenHash !== (await sha256(refreshToken))) {
      // An old (already rotated) refresh token was replayed: possible theft.
      await repo.bumpTokenVersion(a.id);
      return fail(AppErrors.unauthorized("Session invalidated. Please sign in again."));
    }
    if (a.status === "suspended" || !CAN_SIGN_IN.includes(a.status)) return fail(AppErrors.forbidden("This account is not active."));
    const tokens = await issue(a.id, auth.tokenVersion, fingerprint);
    return ok({ astrologer: identity(a), tokens });
  },

  async logout(id: string): Promise<void> {
    await getAstrologerRepository().setAuth(id, { refreshTokenHash: null });
  },

  async logoutAll(id: string): Promise<void> {
    await getAstrologerRepository().bumpTokenVersion(id);
  },

  async changePassword(id: string, current: string, next: string): Promise<Result<{ id: string }>> {
    const issue_ = passwordIssue(next);
    if (issue_) return fail(AppErrors.validation(issue_));
    if (current === next) return fail(AppErrors.validation("Choose a password different from the current one"));
    const repo = getAstrologerRepository();
    const auth = await repo.getAuth(id);
    if (!auth || !(await verifyPassword(current, auth.passwordHash))) return fail(AppErrors.validation("Current password is incorrect"));
    await repo.setAuth(id, { passwordHash: await hashPassword(next), refreshTokenHash: null, tokenVersion: auth.tokenVersion + 1 });
    await repo.update(id, { mustChangePassword: false });
    return ok({ id });
  },

  /** Always ok (no enumeration). Token is emailed; returned only outside production for testing. */
  async forgotPassword(email: string): Promise<Result<{ sent: true; devToken?: string }>> {
    const repo = getAstrologerRepository();
    const a = await repo.findByEmail(email.trim().toLowerCase());
    if (!a || a.status === "suspended") return ok({ sent: true });
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const raw = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    await repo.setAuth(a.id, { passwordResetTokenHash: await sha256(raw), passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000) });
    mailPasswordReset(a.email, a.displayName, `${BRAND.url}/astrologer/reset-password?token=${raw}`);
    return ok(env.NODE_ENV === "production" ? { sent: true } : { sent: true, devToken: raw });
  },

  async resetPassword(token: string, next: string): Promise<Result<{ id: string }>> {
    const issue_ = passwordIssue(next);
    if (issue_) return fail(AppErrors.validation(issue_));
    const repo = getAstrologerRepository();
    const id = await repo.findIdByResetHash(await sha256(token));
    if (!id) return fail(AppErrors.validation("This reset link is invalid or has expired"));
    const auth = await repo.getAuth(id);
    await repo.setAuth(id, {
      passwordHash: await hashPassword(next), passwordResetTokenHash: null, passwordResetExpires: null,
      refreshTokenHash: null, failedLoginCount: 0, lockedUntil: null, tokenVersion: (auth?.tokenVersion ?? 0) + 1,
    });
    await repo.update(id, { mustChangePassword: false });
    return ok({ id });
  },
};
