/**
 * Admin auth domain — service (high-security session model).
 *
 * Login issues TWO tokens, both in httpOnly cookies:
 *   • access  (15 min)  — sent on every request, verified fast.
 *   • refresh (30 days) — used only to mint a new access token; rotated each
 *     use; its hash is stored on the user so a stolen refresh token is useless
 *     once rotated or when the user's tokenVersion is bumped.
 *
 * Anti-theft layers:
 *   • tokenVersion — every token carries `ver`; must equal the user's current
 *     tokenVersion. Bumping it (password change / logout-everywhere) kills ALL
 *     tokens instantly.
 *   • device fingerprint `fp` — token is bound to the login IP + user-agent;
 *     a token replayed from a different device fails fingerprint check.
 *   • fresh DB load — disabled/suspended/deleted users are rejected immediately.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { userService, getUserRepository } from "@/modules/users";
import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  deviceFingerprint,
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
} from "@/core/jwt";
import { sha256 } from "@/core/hash";
import type { AdminUser, AdminSession } from "./admin-auth.types";

export const ACCESS_COOKIE = "astrounkle_admin_session";
export const REFRESH_COOKIE = "astrounkle_admin_refresh";
// Kept for backward-compat with existing imports.
export const COOKIE_NAME = ACCESS_COOKIE;

export interface IssuedTokens {
  accessToken: string;
  accessMaxAge: number;
  refreshToken: string;
  refreshMaxAge: number;
}

async function issueTokens(
  user: { id: string; roleId: string; tokenVersion: number },
  fp: string,
): Promise<IssuedTokens> {
  const base = { sub: user.id, roleId: user.roleId, ver: user.tokenVersion, fp };
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(base),
    signRefreshToken(base),
  ]);
  // Store the refresh token's hash + fingerprint for rotation/validation.
  const repo = getUserRepository();
  await repo.setRefreshToken(user.id, await sha256(refreshToken), fp);
  return {
    accessToken,
    accessMaxAge: ACCESS_TTL_SECONDS,
    refreshToken,
    refreshMaxAge: REFRESH_TTL_SECONDS,
  };
}

export const adminAuthService = {
  /** Verify credentials and mint access + refresh tokens. */
  async login(
    email: string,
    password: string,
    ctx: { ip: string; userAgent: string },
  ): Promise<Result<{ tokens: IssuedTokens; user: AdminUser; mustChangePassword: boolean }>> {
    const res = await userService.authenticate(email, password, ctx.ip);
    if (!res.ok) return fail(res.error);
    const u = res.value;

    const repo = getUserRepository();
    const tokenVersion = (await repo.getTokenVersion(u.id)) ?? 0;
    const fp = await deviceFingerprint(ctx.ip, ctx.userAgent);
    const tokens = await issueTokens({ id: u.id, roleId: u.roleId, tokenVersion }, fp);

    const user: AdminUser = {
      id: u.id,
      name: u.name,
      email: u.email,
      roleId: u.roleId,
      roleName: u.role.name,
      permissions: u.permissions,
    };
    return ok({ tokens, user, mustChangePassword: u.mustChangePassword });
  },

  /**
   * Exchange a valid refresh token for a fresh access token (and rotate the
   * refresh token). Enforces: signature, kind, tokenVersion, stored-hash match,
   * and device fingerprint. Any mismatch → reject (forces re-login).
   */
  async refresh(
    refreshToken: string | undefined,
    ctx: { ip: string; userAgent: string },
  ): Promise<Result<{ tokens: IssuedTokens }>> {
    const claims = await verifyToken(refreshToken, "refresh");
    if (!claims || !refreshToken) return fail(AppErrors.unauthorized("Session expired"));

    const repo = getUserRepository();
    const refreshAuth = await repo.getRefreshAuth(claims.sub);
    if (!refreshAuth) return fail(AppErrors.unauthorized("Session expired"));

    // Token version must still match (not revoked / logged-out-everywhere).
    if (claims.ver !== refreshAuth.tokenVersion) {
      return fail(AppErrors.unauthorized("Session revoked"));
    }
    // The presented refresh token must be the current stored one (rotation).
    const presentedHash = await sha256(refreshToken);
    if (!refreshAuth.hash || presentedHash !== refreshAuth.hash) {
      return fail(AppErrors.unauthorized("Session no longer valid"));
    }
    // Device fingerprint must match the one bound at login.
    const fp = await deviceFingerprint(ctx.ip, ctx.userAgent);
    if (refreshAuth.fingerprint && refreshAuth.fingerprint !== fp) {
      // Possible token theft from another device — kill the session hard.
      await repo.bumpTokenVersion(claims.sub);
      return fail(AppErrors.unauthorized("Session blocked (device mismatch). Please sign in again."));
    }

    // Still a usable account?
    const found = await userService.getById(claims.sub);
    if (!found.ok) return fail(AppErrors.unauthorized("Session expired"));
    const u = found.value;
    if (u.status === "disabled" || u.status === "suspended" || u.isDeleted) {
      return fail(AppErrors.forbidden("This account is not active."));
    }

    const tokens = await issueTokens(
      { id: u.id, roleId: u.roleId, tokenVersion: refreshAuth.tokenVersion },
      fp,
    );
    return ok({ tokens });
  },

  /**
   * Resolve the session from the ACCESS token: verify, check tokenVersion +
   * fingerprint, then load the user fresh from the DB.
   */
  async getSession(
    accessToken: string | undefined,
    ctx: { ip: string; userAgent: string },
  ): Promise<AdminSession | null> {
    const claims = await verifyToken(accessToken, "access");
    if (!claims) return null;

    const repo = getUserRepository();
    const currentVersion = await repo.getTokenVersion(claims.sub);
    if (currentVersion === null || claims.ver !== currentVersion) return null;

    // Device binding.
    const fp = await deviceFingerprint(ctx.ip, ctx.userAgent);
    if (claims.fp && claims.fp !== fp) return null;

    const found = await userService.getById(claims.sub);
    if (!found.ok) return null;
    const u = found.value;
    if (u.status === "disabled" || u.status === "suspended" || u.isDeleted) return null;

    return {
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        roleId: u.roleId,
        roleName: u.role.name,
        permissions: u.permissions,
      },
      expiresAt: 0,
    };
  },

  /** Clear the stored refresh token (logout for this device). */
  async logout(userId: string | undefined): Promise<void> {
    if (!userId) return;
    const repo = getUserRepository();
    await repo.setRefreshToken(userId, null, null);
  },

  accessTtlSeconds: ACCESS_TTL_SECONDS,
  refreshTtlSeconds: REFRESH_TTL_SECONDS,
};
