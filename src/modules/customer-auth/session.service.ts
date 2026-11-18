import "server-only";

/**
 * Customer sessions: one per device, shared by the website and the mobile app.
 *
 *  • Access token: 15-min JWT { sub, sid, ver }. Verified by signature; the
 *    session row is re-checked (cached 30 s) so a revoke applies quickly.
 *  • Refresh token: opaque "<sid>.<32 random bytes>", SHA-256 stored. ROTATED
 *    on every use (atomic compare-and-set, safe under races).
 *  • Grace window (30 s): the token that was just rotated is still accepted
 *    once more, because on mobile networks the refresh response is often lost.
 *    Anything older = token reuse → that ONE session is revoked (theft signal);
 *    the customer's other devices keep working.
 *  • Sliding expiry: 30 days from last use, at most 90 days from sign-in.
 *  • Legacy web cookies (JWT refresh + customer.refreshTokenHash) are migrated
 *    into a session on their next refresh, so nobody has to sign in again.
 */

import { createHash, randomBytes } from "node:crypto";
import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { cache } from "@/core/cache";
import { logger } from "@/core/logger";
import { signCustomerAccessToken, verifyCustomerToken, CUSTOMER_ACCESS_TTL_SECONDS } from "@/core/customer-jwt";

export type ClientKind = "web" | "android" | "ios";

export interface SessionCtx {
  client: ClientKind;
  deviceId: string;
  deviceName?: string;
  appVersion?: string;
  ip: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  sessionId: string;
}

export interface SessionView {
  id: string;
  client: ClientKind;
  deviceName: string;
  appVersion: string;
  ipLast: string;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

const SLIDE_MS = 30 * 86400_000;
const HARD_MS = 90 * 86400_000;
const GRACE_MS = 30_000;
const CHECK_TTL = 30; // seconds a session check is cached
export const MAX_SESSIONS = 10; // per customer; the oldest is signed out beyond this

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const isOid = (id: string) => /^[a-f0-9]{24}$/i.test(id);
const cacheKey = (sid: string) => `custsess:${sid}`;

async function models() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  const [{ SessionModel }, { CustomerModel }] = await Promise.all([import("./session.model"), import("@/modules/customers/customer.model")]);
  return { SessionModel, CustomerModel };
}

function newRefresh(sid: string) {
  const token = `${sid}.${randomBytes(32).toString("base64url")}`;
  return { token, hash: sha(token) };
}

async function accessFor(customerId: string, sid: string, ver: number) {
  return signCustomerAccessToken({ sub: customerId, ver, fp: "", sid });
}

/** Human device label from a user agent (web) or the app-provided name. */
export function deviceLabel(ua: string): string {
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Unknown OS";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

export const sessionService = {
  /** Sign a customer in on one device. Reuses the device's open session if any. */
  async create(customerId: string, ctx: SessionCtx): Promise<SessionTokens> {
    const { SessionModel, CustomerModel } = await models();
    const c = await CustomerModel.findById(customerId).select("+tokenVersion").lean<{ tokenVersion?: number }>();
    const ver = c?.tokenVersion ?? 0;
    const now = new Date();
    // Same device signing in again: close its previous session first.
    await SessionModel.updateMany({ customerId, deviceId: ctx.deviceId, revokedAt: null }, { $set: { revokedAt: now, revokeReason: "replaced" } });

    const s = await SessionModel.create({
      customerId, refreshHash: "pending", client: ctx.client, deviceId: ctx.deviceId,
      deviceName: (ctx.deviceName ?? "").slice(0, 120), appVersion: (ctx.appVersion ?? "").slice(0, 30),
      ipFirst: ctx.ip, ipLast: ctx.ip, createdAt: now, lastUsedAt: now,
      expiresAt: new Date(now.getTime() + SLIDE_MS), hardExpiresAt: new Date(now.getTime() + HARD_MS),
    });
    const sid = String(s._id);
    const r = newRefresh(sid);
    await SessionModel.updateOne({ _id: s._id }, { $set: { refreshHash: r.hash } });

    // Cap active sessions per customer (oldest first).
    const active = await SessionModel.find({ customerId, revokedAt: null }).sort({ lastUsedAt: -1 }).select("_id").lean<{ _id: unknown }[]>();
    if (active.length > MAX_SESSIONS) {
      const extra = active.slice(MAX_SESSIONS).map((x) => x._id);
      await SessionModel.updateMany({ _id: { $in: extra } }, { $set: { revokedAt: now, revokeReason: "too_many_devices" } });
    }
    await CustomerModel.updateOne({ _id: customerId }, { $set: { lastLoginAt: now } });
    return { accessToken: await accessFor(customerId, sid, ver), refreshToken: r.token, expiresIn: CUSTOMER_ACCESS_TTL_SECONDS, sessionId: sid };
  },

  /** Rotate a refresh token. Handles the grace window and legacy cookies. */
  async refresh(presented: string, ctx: SessionCtx): Promise<Result<SessionTokens & { customerId: string }>> {
    if (!presented) return fail(AppErrors.unauthorized("Session expired"));
    const { SessionModel, CustomerModel } = await models();

    // ---- legacy web cookie (JWT refresh from before sessions) ----
    if (!/^[a-f0-9]{24}\./.test(presented)) {
      const claims = await verifyCustomerToken(presented, "refresh");
      if (!claims) return fail(AppErrors.unauthorized("Session expired"));
      const c = await CustomerModel.findOne({ _id: claims.sub, isDeleted: { $ne: true } }).select("+tokenVersion +refreshTokenHash status").lean<{ _id: unknown; tokenVersion?: number; refreshTokenHash?: string | null; status?: string }>();
      if (!c || c.status === "blocked" || (c.tokenVersion ?? 0) !== claims.ver || c.refreshTokenHash !== sha(presented)) {
        return fail(AppErrors.unauthorized("Session expired. Please sign in again."));
      }
      await CustomerModel.updateOne({ _id: String(c._id) }, { $set: { refreshTokenHash: null } });
      const t = await this.create(String(c._id), ctx);
      return ok({ ...t, customerId: String(c._id) });
    }

    const sid = presented.slice(0, 24);
    if (!isOid(sid)) return fail(AppErrors.unauthorized("Session expired"));
    const s = await SessionModel.findById(sid).lean<Record<string, unknown> & { _id: unknown }>();
    const now = new Date();
    if (!s || s.revokedAt || (s.expiresAt as Date) <= now || (s.hardExpiresAt as Date) <= now) {
      return fail(AppErrors.unauthorized("Session expired. Please sign in again."));
    }
    const h = sha(presented);
    const inGrace = s.prevRefreshHash === h && s.prevValidUntil && (s.prevValidUntil as Date) > now;
    if (s.refreshHash !== h && !inGrace) {
      // Reuse of an old token: treat as theft, end this session only.
      await SessionModel.updateOne({ _id: s._id }, { $set: { revokedAt: now, revokeReason: "refresh_reuse" } });
      cache.del(cacheKey(sid));
      logger.warn("customer refresh token reuse", { sessionId: sid, customerId: String(s.customerId) });
      return fail(AppErrors.unauthorized("Session ended for your security. Please sign in again."));
    }

    const c = await CustomerModel.findOne({ _id: String(s.customerId), isDeleted: { $ne: true } }).select("+tokenVersion status").lean<{ tokenVersion?: number; status?: string }>();
    if (!c) return fail(AppErrors.unauthorized("Session expired"));
    if (c.status === "blocked") return fail(AppErrors.forbidden("This account has been disabled. Contact support."));

    const r = newRefresh(sid);
    const expiresAt = new Date(Math.min(now.getTime() + SLIDE_MS, (s.hardExpiresAt as Date).getTime()));
    // Compare-and-set on the hash we matched: two refreshes racing can't both win.
    const matchedField = s.refreshHash === h ? { refreshHash: h } : { prevRefreshHash: h };
    const set: Record<string, unknown> = {
      refreshHash: r.hash, lastUsedAt: now, expiresAt, ipLast: ctx.ip,
      ...(ctx.appVersion ? { appVersion: ctx.appVersion.slice(0, 30) } : {}),
    };
    // Only a normal rotation moves the grace window; a grace retry keeps the original one.
    if (s.refreshHash === h) Object.assign(set, { prevRefreshHash: h, prevValidUntil: new Date(now.getTime() + GRACE_MS) });
    const upd = await SessionModel.updateOne({ _id: s._id, revokedAt: null, ...matchedField }, { $set: set });
    if (upd.modifiedCount !== 1) return fail(AppErrors.unauthorized("Session expired. Please sign in again."));
    cache.del(cacheKey(sid));
    const customerId = String(s.customerId);
    return ok({ accessToken: await accessFor(customerId, sid, c.tokenVersion ?? 0), refreshToken: r.token, expiresIn: CUSTOMER_ACCESS_TTL_SECONDS, sessionId: sid, customerId });
  },

  /** Is this session still valid? (cached briefly; used by the guard on every request) */
  async check(sid: string, customerId: string, ver: number): Promise<"ok" | "expired" | "blocked"> {
    const hit = cache.get<"ok" | "expired" | "blocked">(cacheKey(sid));
    if (hit) return hit;
    if (!isOid(sid)) return "expired";
    const { SessionModel, CustomerModel } = await models();
    const [s, c] = await Promise.all([
      SessionModel.findById(sid).select("customerId revokedAt expiresAt").lean<{ customerId: string; revokedAt: Date | null; expiresAt: Date }>(),
      CustomerModel.findOne({ _id: customerId, isDeleted: { $ne: true } }).select("+tokenVersion status").lean<{ tokenVersion?: number; status?: string }>(),
    ]);
    let r: "ok" | "expired" | "blocked" = "ok";
    if (!s || s.customerId !== customerId || s.revokedAt || s.expiresAt <= new Date() || !c || (c.tokenVersion ?? 0) !== ver) r = "expired";
    else if (c.status === "blocked") r = "blocked";
    cache.set(cacheKey(sid), r, CHECK_TTL);
    return r;
  },

  async revoke(sid: string, reason: string, customerId?: string): Promise<boolean> {
    if (!isOid(sid)) return false;
    const { SessionModel } = await models();
    const r = await SessionModel.updateOne({ _id: sid, revokedAt: null, ...(customerId ? { customerId } : {}) }, { $set: { revokedAt: new Date(), revokeReason: reason } });
    cache.del(cacheKey(sid));
    return r.modifiedCount === 1;
  },

  /** Sign out every device (optionally keeping the current one). */
  async revokeAll(customerId: string, reason: string, exceptSid?: string): Promise<number> {
    const { SessionModel } = await models();
    const q: Record<string, unknown> = { customerId, revokedAt: null };
    const ids = (await SessionModel.find(q).select("_id").lean<{ _id: unknown }[]>()).map((x) => String(x._id)).filter((id) => id !== exceptSid);
    if (!ids.length) return 0;
    await SessionModel.updateMany({ _id: { $in: ids } }, { $set: { revokedAt: new Date(), revokeReason: reason } });
    ids.forEach((id) => cache.del(cacheKey(id)));
    return ids.length;
  },

  async list(customerId: string, currentSid?: string): Promise<SessionView[]> {
    const { SessionModel } = await models();
    const rows = await SessionModel.find({ customerId, revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ lastUsedAt: -1 }).lean<Record<string, unknown>[]>();
    return rows.map((s) => ({
      id: String(s._id), client: s.client as ClientKind, deviceName: String(s.deviceName || "Unknown device"), appVersion: String(s.appVersion ?? ""),
      ipLast: String(s.ipLast ?? ""), createdAt: (s.createdAt as Date).toISOString(), lastUsedAt: (s.lastUsedAt as Date).toISOString(),
      current: String(s._id) === currentSid,
    }));
  },
};
