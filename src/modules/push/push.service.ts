import "server-only";

/**
 * Push notifications: devices, preferences, outbox, sending, receipts, inbox.
 * Rules and the pipeline are described in push.types.ts.
 */

import crypto from "node:crypto";
import { after } from "next/server";
import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { auditService } from "@/modules/audit";
import { astroSettingsService } from "@/modules/astro-settings";
import { EXPO_TOKEN_RE, ExpoHttpError, expoTransport, type ExpoMessage, type ExpoTicket, type PushTransport } from "./push.expo";
import { PUSH_GROUPS, type InboxItem, type PushChannel, type PushDevice, type PushGroup, type PushMessageInput, type PushPrefs, type PushRowView } from "./push.types";

type Doc = Record<string, unknown> & { _id: unknown };

async function M() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return import("./push.model");
}

let transport: PushTransport = expoTransport;
/** Tests only: replace the Expo HTTP client. */
export function setPushTransport(t: PushTransport | null) { transport = t ?? expoTransport; }

const nowIso = () => new Date().toISOString();
const MAX_ATTEMPTS = 5;
const MAX_DEVICES = 10;
const LEASE_MS = 60_000;
const RECEIPT_DELAY_MS = 15 * 60_000;

const CHANNEL: Record<PushGroup, PushChannel> = { chat: "chat", wallet: "chat", live: "live", reminders: "live", orders: "orders" };
/** Retry wait: 30 s, 1 min, 2 min, 4 min… */
const backoff = (attempt: number) => Math.min(30_000 * 2 ** Math.max(0, attempt - 1), 30 * 60_000);

function isDup(e: unknown) {
  const err = e as { code?: number; writeErrors?: { code?: number }[] };
  return err?.code === 11000 || (Array.isArray(err?.writeErrors) && err.writeErrors.every((w) => w.code === 11000));
}

/* ============================================================ *
 * Quiet hours (IST)
 * ============================================================ */

const IST_MIN = 330;
const hm = (s: string) => { const [h, m] = s.split(":").map(Number); return (h % 24) * 60 + (m % 60); };
/** If `ms` falls inside the quiet window, the time (ms) it ends; else null. */
export function quietEndsAt(ms: number, start: string, end: string): number | null {
  const s = hm(start), e = hm(end);
  if (s === e) return null;
  const m = Math.floor((((ms / 60_000) + IST_MIN) % 1440 + 1440) % 1440);
  const inside = s < e ? m >= s && m < e : m >= s || m < e;
  if (!inside) return null;
  const wait = (e - m + 1440) % 1440 || 1440;
  return ms - (ms % 60_000) + wait * 60_000;
}

/* ============================================================ *
 * Preferences
 * ============================================================ */

async function defaults(): Promise<PushPrefs> {
  const st = await astroSettingsService.get();
  return { groups: Object.fromEntries(PUSH_GROUPS.map((g) => [g, true])) as Record<PushGroup, boolean>, quiet: { enabled: true, start: st.push.quietStart, end: st.push.quietEnd }, updatedAt: null };
}
function prefOut(d: Doc | null, base: PushPrefs): PushPrefs {
  if (!d) return base;
  const g = (d.groups as Partial<Record<PushGroup, boolean>>) ?? {};
  const q = (d.quiet as Partial<PushPrefs["quiet"]>) ?? {};
  return {
    groups: Object.fromEntries(PUSH_GROUPS.map((k) => [k, g[k] !== false])) as Record<PushGroup, boolean>,
    quiet: { enabled: q.enabled !== false, start: q.start ?? base.quiet.start, end: q.end ?? base.quiet.end },
    updatedAt: (d.updatedAt as string) ?? null,
  };
}

/* ============================================================ *
 * Devices
 * ============================================================ */

const deviceOut = (d: Doc): PushDevice => ({
  id: String(d._id), token: d.token as string, customerId: d.customerId as string, platform: d.platform as PushDevice["platform"], app: (d.app as string) ?? "",
  appVersion: (d.appVersion as string) ?? "", deviceName: (d.deviceName as string) ?? "", active: Boolean(d.active), createdAt: d.createdAt as string,
  lastSeenAt: d.lastSeenAt as string, disabledReason: (d.disabledReason as string) ?? null,
});

async function disableTokens(tokens: string[], reason: string) {
  if (!tokens.length) return;
  const { PushDeviceModel } = await M();
  await PushDeviceModel.updateMany({ token: { $in: tokens }, active: true }, { $set: { active: false, disabledReason: reason, lastSeenAt: nowIso() } });
}

/* ============================================================ *
 * Queue + send
 * ============================================================ */

function safeUrl(u: string): string {
  // In-app routes only: never an external link or a protocol-relative URL.
  return typeof u === "string" && u.startsWith("/") && !u.startsWith("//") && u.length <= 300 ? u : "/";
}

/**
 * One drain at a time per server: a second caller waits for the running one
 * and then runs once more (so nothing queued meanwhile is left behind).
 * Rows are claimed atomically, so several servers never send a row twice.
 */
type DrainResult = { sent: number; skipped: number; failed: number; retried: number };
let draining: Promise<DrainResult> | null = null;
let again = false;
async function drainLocked(): Promise<DrainResult> {
  if (draining) { again = true; await draining.catch(() => undefined); if (draining) return draining; }
  draining = (async () => {
    const total: DrainResult = { sent: 0, skipped: 0, failed: 0, retried: 0 };
    do {
      again = false;
      const r = await drainOnce().catch(() => ({ sent: 0, skipped: 0, failed: 0, retried: 0 }));
      total.sent += r.sent; total.skipped += r.skipped; total.failed += r.failed; total.retried += r.retried;
    } while (again);
    return total;
  })().finally(() => { draining = null; });
  return draining;
}

/** Send what is due, right after the current response (or now, outside a request). */
function kick() {
  const run = () => drainLocked();
  try { after(run); } catch { void run(); }
}

async function queue(input: PushMessageInput | PushMessageInput[]): Promise<number> {
  const list = (Array.isArray(input) ? input : [input]).filter((m) => m.customerId && m.key && m.title);
  if (!list.length) return 0;
  const { PushOutboxModel } = await M();
  const at = new Date();
  const docs = list.map((m) => ({
    key: m.key.slice(0, 200), customerId: m.customerId, group: m.group, kind: m.kind,
    title: m.title.slice(0, 120), body: (m.body ?? "").slice(0, 400), url: safeUrl(m.url),
    data: Object.fromEntries(Object.entries(m.data ?? {}).slice(0, 12).map(([k, v]) => [k.slice(0, 40), String(v).slice(0, 200)])),
    image: m.image && /^https:\/\//.test(m.image) ? m.image : null,
    channel: CHANNEL[m.group] ?? "default", tag: m.tag ?? null, urgent: Boolean(m.urgent), inbox: Boolean(m.inbox),
    ttlSec: m.ttlSec ?? null, status: "queued", reason: null, sendAfter: at.toISOString(),
    expiresAt: m.ttlSec ? new Date(at.getTime() + m.ttlSec * 1000).toISOString() : null,
    attempts: 0, leaseUntil: null, tickets: [], receiptsAt: null, readAt: null, createdAt: at.toISOString(), sentAt: null, createdOn: at,
  }));
  let n = docs.length;
  try {
    await PushOutboxModel.insertMany(docs, { ordered: false });
  } catch (e) {
    if (!isDup(e)) throw e;
    const inserted = (e as { insertedDocs?: unknown[]; result?: { insertedCount?: number } }).insertedDocs?.length ?? (e as { result?: { insertedCount?: number } }).result?.insertedCount;
    n = typeof inserted === "number" ? inserted : 0;
  }
  if (n > 0) kick();
  return n;
}

type Row = { id: string; key: string; customerId: string; group: PushGroup; kind: string; title: string; body: string; url: string; data: Record<string, string>; image: string | null; channel: string; tag: string | null; urgent: boolean; ttlSec: number | null; expiresAt: string | null; attempts: number };
const rowOf = (d: Doc): Row => ({
  id: String(d._id), key: d.key as string, customerId: d.customerId as string, group: d.group as PushGroup, kind: d.kind as string, title: d.title as string, body: (d.body as string) ?? "",
  url: (d.url as string) ?? "/", data: (d.data as Record<string, string>) ?? {}, image: (d.image as string) ?? null, channel: (d.channel as string) ?? "default", tag: (d.tag as string) ?? null,
  urgent: Boolean(d.urgent), ttlSec: (d.ttlSec as number) ?? null, expiresAt: (d.expiresAt as string) ?? null, attempts: (d.attempts as number) ?? 0,
});

/** Still true at send time? (a live that ended, a turn that passed). */
async function staleIds(rows: Row[]): Promise<Set<string>> {
  const stale = new Set<string>();
  const liveIds = [...new Set(rows.filter((r) => r.data.liveId).map((r) => r.data.liveId))].filter((x) => /^[a-f0-9]{24}$/i.test(x));
  if (liveIds.length) {
    const { LiveSessionModel } = await import("@/modules/live/live.model");
    const on = new Set((await LiveSessionModel.find({ _id: { $in: liveIds }, status: "live" }).select("_id").lean<Doc[]>()).map((d) => String(d._id)));
    for (const r of rows) if (r.data.liveId && !on.has(r.data.liveId)) stale.add(r.id);
  }
  const entryIds = [...new Set(rows.filter((r) => r.data.entryId).map((r) => r.data.entryId))].filter((x) => /^[a-f0-9]{24}$/i.test(x));
  if (entryIds.length) {
    const { default: mongoose } = await import("mongoose");
    const coll = mongoose.connection.collection("consult_waitlist");
    const on = new Set((await coll.find({ _id: { $in: entryIds.map((x) => new mongoose.Types.ObjectId(x)) }, status: "offered" }).project({ _id: 1 }).toArray()).map((d) => String(d._id)));
    for (const r of rows) if (r.data.entryId && !on.has(r.data.entryId)) stale.add(r.id);
  }
  return stale;
}

async function finish(id: string, set: Record<string, unknown>) {
  const { PushOutboxModel } = await M();
  await PushOutboxModel.updateOne({ _id: id, status: "sending" }, { $set: { leaseUntil: null, ...set } });
}

/** Claim and send everything that is due (batches of up to 100 rows). Call through drainLocked(). */
async function drainOnce(maxRows = 1000): Promise<DrainResult> {
  const res = { sent: 0, skipped: 0, failed: 0, retried: 0 };
  const { PushOutboxModel, PushDeviceModel, PushPrefModel } = await M();
  const now = () => nowIso();
  // A crashed sender left rows "sending": put them back.
  await PushOutboxModel.updateMany({ status: "sending", leaseUntil: { $lt: now() } }, { $set: { status: "queued", leaseUntil: null } });

  for (let done = 0; done < maxRows;) {
    const claimed: Row[] = [];
    for (let i = 0; i < 100; i++) {
      const d = await PushOutboxModel.findOneAndUpdate(
        { status: "queued", sendAfter: { $lte: now() } },
        { $set: { status: "sending", leaseUntil: new Date(Date.now() + LEASE_MS).toISOString() }, $inc: { attempts: 1 } },
        { sort: { sendAfter: 1 }, new: true },
      ).lean<Doc>();
      if (!d) break;
      claimed.push(rowOf(d));
    }
    if (!claimed.length) break;
    done += claimed.length;

    const st = await astroSettingsService.get();
    const base = await defaults();
    const customers = [...new Set(claimed.map((r) => r.customerId))];
    const prefs = new Map((await PushPrefModel.find({ customerId: { $in: customers } }).lean<Doc[]>()).map((d) => [d.customerId as string, prefOut(d, base)]));
    const devices = new Map<string, string[]>();
    for (const d of await PushDeviceModel.find({ customerId: { $in: customers }, active: true }).select("customerId token").lean<Doc[]>()) {
      const k = d.customerId as string;
      devices.set(k, [...(devices.get(k) ?? []), d.token as string]);
    }
    const stale = await staleIds(claimed);
    // Daily cap on live alerts: sent in the last 24 h, per customer.
    const liveSent = new Map<string, number>();
    if (st.push.liveDailyCap > 0 && claimed.some((r) => r.group === "live")) {
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const agg = await PushOutboxModel.aggregate([
        { $match: { customerId: { $in: customers }, group: "live", status: "sent", sentAt: { $gte: since } } },
        { $group: { _id: "$customerId", n: { $sum: 1 } } },
      ]);
      for (const a of agg as { _id: string; n: number }[]) liveSent.set(a._id, a.n);
    }

    const ready: { row: Row; tokens: string[] }[] = [];
    for (const r of claimed) {
      const p = prefs.get(r.customerId) ?? base;
      const nowMs = Date.now();
      if (r.expiresAt && Date.parse(r.expiresAt) <= nowMs) { await finish(r.id, { status: "expired", reason: "expired" }); res.skipped++; continue; }
      if (!st.push.enabled) { await finish(r.id, { status: "skipped", reason: "disabled" }); res.skipped++; continue; }
      if (!st.push.groups[r.group]) { await finish(r.id, { status: "skipped", reason: "group_off" }); res.skipped++; continue; }
      if (!p.groups[r.group]) { await finish(r.id, { status: "skipped", reason: "pref_off" }); res.skipped++; continue; }
      if (stale.has(r.id)) { await finish(r.id, { status: "skipped", reason: "stale" }); res.skipped++; continue; }
      if (!r.urgent && p.quiet.enabled) {
        const until = quietEndsAt(nowMs, p.quiet.start, p.quiet.end);
        if (until) {
          if (r.expiresAt && Date.parse(r.expiresAt) <= until) { await finish(r.id, { status: "skipped", reason: "expired_in_quiet" }); res.skipped++; continue; }
          // Wait for the morning; this attempt does not count.
          await finish(r.id, { status: "queued", sendAfter: new Date(until).toISOString(), attempts: Math.max(0, r.attempts - 1) });
          continue;
        }
      }
      if (r.group === "live" && st.push.liveDailyCap > 0) {
        const n = liveSent.get(r.customerId) ?? 0;
        if (n >= st.push.liveDailyCap) { await finish(r.id, { status: "skipped", reason: "daily_cap" }); res.skipped++; continue; }
        liveSent.set(r.customerId, n + 1);
      }
      const tokens = devices.get(r.customerId) ?? [];
      if (!tokens.length) { await finish(r.id, { status: "skipped", reason: "no_device" }); res.skipped++; continue; }
      ready.push({ row: r, tokens });
    }
    if (!ready.length) continue;

    const msgs: ExpoMessage[] = [];
    const owner: { row: Row; token: string }[] = [];
    for (const { row: r, tokens } of ready) {
      const ttl = r.expiresAt ? Math.max(1, Math.round((Date.parse(r.expiresAt) - Date.now()) / 1000)) : undefined;
      for (const to of tokens) {
        msgs.push({
          to, title: r.title, body: r.body, sound: "default",
          data: { ...r.data, url: r.url, group: r.group, kind: r.kind, pushId: r.id },
          priority: r.urgent || r.group === "live" || r.group === "reminders" ? "high" : "default",
          channelId: r.channel, ...(ttl ? { ttl } : {}),
          ...(r.tag ? { tag: r.tag, collapseId: r.tag, threadId: r.tag } : {}),
          ...(r.image ? { richContent: { image: r.image } } : {}),
        });
        owner.push({ row: r, token: to });
      }
    }

    let tickets: ExpoTicket[] = [];
    try {
      tickets = await transport.send(msgs);
    } catch (e) {
      const retry = !(e instanceof ExpoHttpError) || e.retryable;
      for (const { row: r } of ready) {
        if (retry && r.attempts < MAX_ATTEMPTS) { await finish(r.id, { status: "queued", sendAfter: new Date(Date.now() + backoff(r.attempts)).toISOString(), reason: `retry: ${(e as Error).message}`.slice(0, 200) }); res.retried++; }
        else { await finish(r.id, { status: "failed", reason: (e as Error).message.slice(0, 200) }); res.failed++; }
      }
      continue;
    }

    const dead: string[] = [];
    const per = new Map<string, { ok: { token: string; id: string }[]; retry: number; errors: string[] }>();
    owner.forEach((o, i) => {
      const t = tickets[i];
      const acc = per.get(o.row.id) ?? { ok: [], retry: 0, errors: [] };
      if (t?.status === "ok" && t.id) acc.ok.push({ token: o.token, id: t.id });
      else {
        const code = t?.details?.error ?? "Unknown";
        if (code === "DeviceNotRegistered") dead.push(o.token);
        else if (code === "MessageRateExceeded") acc.retry++;
        acc.errors.push(code);
      }
      per.set(o.row.id, acc);
    });
    await disableTokens(dead, "DeviceNotRegistered");
    for (const { row: r } of ready) {
      const acc = per.get(r.id) ?? { ok: [], retry: 0, errors: ["NoTicket"] };
      if (acc.ok.length) { await finish(r.id, { status: "sent", sentAt: nowIso(), reason: acc.errors.length ? acc.errors.join(",").slice(0, 200) : null, tickets: acc.ok }); res.sent++; }
      else if (acc.retry && r.attempts < MAX_ATTEMPTS) { await finish(r.id, { status: "queued", sendAfter: new Date(Date.now() + backoff(r.attempts)).toISOString(), reason: "MessageRateExceeded" }); res.retried++; }
      else { await finish(r.id, { status: acc.errors.every((x) => x === "DeviceNotRegistered") ? "skipped" : "failed", reason: acc.errors.join(",").slice(0, 200) }); res.failed++; }
    }
  }
  return res;
}

let credWarned = 0;
/** Push receipts (~15 min after sending): turn off dead devices, flag credential problems. */
async function checkReceipts(): Promise<{ checked: number; dead: number }> {
  const { PushOutboxModel } = await M();
  const cutoff = new Date(Date.now() - RECEIPT_DELAY_MS).toISOString();
  const rows = await PushOutboxModel.find({ status: "sent", receiptsAt: null, sentAt: { $lte: cutoff } }).select("_id tickets").limit(500).lean<Doc[]>();
  if (!rows.length) return { checked: 0, dead: 0 };
  const byId = new Map<string, { row: string; token: string }>();
  for (const r of rows) for (const t of (r.tickets as { token: string; id: string }[]) ?? []) byId.set(t.id, { row: String(r._id), token: t.token });
  let receipts: Record<string, { status: string; details?: { error?: string } }> = {};
  try { receipts = byId.size ? await transport.receipts([...byId.keys()]) : {}; } catch { return { checked: 0, dead: 0 }; }
  const dead: string[] = [];
  const delivered = new Map<string, number>();
  let credProblem = "";
  for (const [id, rc] of Object.entries(receipts)) {
    const o = byId.get(id);
    if (!o) continue;
    if (rc.status === "ok") delivered.set(o.row, (delivered.get(o.row) ?? 0) + 1);
    else if (rc.details?.error === "DeviceNotRegistered") dead.push(o.token);
    else if (rc.details?.error === "InvalidCredentials" || rc.details?.error === "MismatchSenderId") credProblem = rc.details.error;
  }
  await disableTokens(dead, "DeviceNotRegistered (receipt)");
  for (const r of rows) await PushOutboxModel.updateOne({ _id: r._id }, { $set: { receiptsAt: nowIso(), delivered: delivered.get(String(r._id)) ?? 0 } });
  if (credProblem && Date.now() - credWarned > 6 * 3600_000) {
    credWarned = Date.now();
    await auditService.record({ action: "update", entity: "settings", entityId: "push", entityLabel: "Push notifications", summary: `Push credentials problem reported by FCM/APNs: ${credProblem}. Check the FCM V1 key in Expo credentials.`, actor: "System" }).catch(() => undefined);
  }
  return { checked: rows.length, dead: dead.length };
}

async function sweep() {
  const sent = await drainLocked();
  const receipts = await checkReceipts().catch(() => ({ checked: -1, dead: 0 }));
  let watched = { queued: 0 };
  try { const { watchStatuses } = await import("./push.events"); watched = await watchStatuses(); } catch { /* next sweep */ }
  return { ...sent, receipts, watched };
}

let lastSweep = 0;
let sweeping: Promise<unknown> | null = null;
/** Cheap, throttled: call from busy endpoints so pushes go out without waiting for the cron. */
function maybeSweep(everyMs = 30_000): void {
  if (sweeping || Date.now() - lastSweep < everyMs) return;
  lastSweep = Date.now();
  const run = () => (sweeping = sweep().catch(() => undefined).finally(() => { sweeping = null; }));
  try { after(run); } catch { void run(); }
}

/* ============================================================ *
 * Inbox
 * ============================================================ */

const inboxOut = (d: Doc): InboxItem => ({
  id: String(d._id), group: d.group as PushGroup, kind: d.kind as string, title: d.title as string, body: (d.body as string) ?? "",
  url: (d.url as string) ?? "/", image: (d.image as string) ?? null, at: d.createdAt as string, read: Boolean(d.readAt),
});

/* ============================================================ *
 * Public API
 * ============================================================ */

export const pushService = {
  queue,
  drain: drainLocked,
  checkReceipts,
  sweep,
  maybeSweep,

  async register(customerId: string, input: { token: string; platform: "android" | "ios"; app?: string; appVersion?: string; deviceName?: string }): Promise<Result<PushDevice>> {
    const token = input.token.trim();
    if (!EXPO_TOKEN_RE.test(token)) return fail(AppErrors.validation("Invalid push token"));
    const { PushDeviceModel } = await M();
    const at = nowIso();
    const d = await PushDeviceModel.findOneAndUpdate(
      { token },
      {
        $set: { customerId, platform: input.platform, app: (input.app ?? "").slice(0, 80), appVersion: (input.appVersion ?? "").slice(0, 30), deviceName: (input.deviceName ?? "").slice(0, 80), active: true, disabledReason: null, lastSeenAt: at },
        $setOnInsert: { createdAt: at },
      },
      { upsert: true, new: true },
    ).lean<Doc>();
    // Keep the newest few devices per customer.
    const extra = await PushDeviceModel.find({ customerId, active: true }).sort({ lastSeenAt: -1 }).skip(MAX_DEVICES).select("token").lean<Doc[]>();
    await disableTokens(extra.map((x) => x.token as string), "too many devices");
    return ok(deviceOut(d!));
  },

  /** Sign-out / turned off on the phone. Needs only the token (works after the session is gone). */
  async unregister(token: string, reason = "signed out"): Promise<void> {
    if (!EXPO_TOKEN_RE.test(token.trim())) return;
    await disableTokens([token.trim()], reason);
  },

  async prefs(customerId: string): Promise<PushPrefs> {
    const { PushPrefModel } = await M();
    return prefOut(await PushPrefModel.findOne({ customerId }).lean<Doc>(), await defaults());
  },

  async setPrefs(customerId: string, input: { groups?: Partial<Record<PushGroup, boolean>>; quiet?: Partial<PushPrefs["quiet"]> }): Promise<Result<PushPrefs>> {
    const cur = await this.prefs(customerId);
    const groups = { ...cur.groups };
    for (const g of PUSH_GROUPS) if (typeof input.groups?.[g] === "boolean") groups[g] = input.groups[g]!;
    const re = /^([01]\d|2[0-3]):[0-5]\d$/;
    const q = { ...cur.quiet, ...(input.quiet ?? {}) };
    if (!re.test(q.start) || !re.test(q.end)) return fail(AppErrors.validation("Quiet hours must be HH:MM"));
    const { PushPrefModel } = await M();
    const at = nowIso();
    await PushPrefModel.updateOne({ customerId }, { $set: { groups, quiet: { enabled: Boolean(q.enabled), start: q.start, end: q.end }, updatedAt: at } }, { upsert: true });
    return ok({ groups, quiet: { enabled: Boolean(q.enabled), start: q.start, end: q.end }, updatedAt: at });
  },

  async inbox(customerId: string, before?: string): Promise<{ items: InboxItem[]; unread: number; nextBefore: string | null }> {
    const { PushOutboxModel } = await M();
    const q: Record<string, unknown> = { customerId, inbox: true, status: { $ne: "expired" }, ...(before ? { createdAt: { $lt: before } } : {}) };
    const rows = await PushOutboxModel.find(q).sort({ createdAt: -1 }).limit(31).lean<Doc[]>();
    const items = rows.slice(0, 30).map(inboxOut);
    const unread = await PushOutboxModel.countDocuments({ customerId, inbox: true, status: { $ne: "expired" }, readAt: null });
    return { items, unread, nextBefore: rows.length > 30 ? items[items.length - 1].at : null };
  },

  async markRead(customerId: string, ids: string[] | "all"): Promise<{ unread: number }> {
    const { PushOutboxModel } = await M();
    const at = nowIso();
    const q: Record<string, unknown> = { customerId, inbox: true, readAt: null };
    if (ids !== "all") q._id = { $in: ids.filter((x) => /^[a-f0-9]{24}$/i.test(x)).slice(0, 100) };
    await PushOutboxModel.updateMany(q, { $set: { readAt: at } });
    return { unread: await PushOutboxModel.countDocuments({ customerId, inbox: true, status: { $ne: "expired" }, readAt: null }) };
  },

  /** Tapped a push: mark that row read (the app sends the pushId from the data). */
  async opened(customerId: string, pushId: string): Promise<void> {
    if (!/^[a-f0-9]{24}$/i.test(pushId)) return;
    const { PushOutboxModel } = await M();
    await PushOutboxModel.updateOne({ _id: pushId, customerId, readAt: null }, { $set: { readAt: nowIso() } });
  },

  /* ---------- admin ---------- */

  async adminStats(f: { status?: string; group?: string; before?: string } = {}): Promise<{ devices: { active: number; customers: number; disabled: number }; last24h: Record<string, number>; reasons: Record<string, number>; rows: PushRowView[]; nextBefore: string | null; expoTokenSet: boolean }> {
    const { PushDeviceModel, PushOutboxModel } = await M();
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const [active, disabled, customers, byStatus, byReason] = await Promise.all([
      PushDeviceModel.countDocuments({ active: true }),
      PushDeviceModel.countDocuments({ active: false }),
      PushDeviceModel.distinct("customerId", { active: true }).then((x) => x.length),
      PushOutboxModel.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
      PushOutboxModel.aggregate([{ $match: { createdAt: { $gte: since }, status: { $in: ["skipped", "failed", "expired"] } } }, { $group: { _id: "$reason", n: { $sum: 1 } } }]),
    ]);
    const q: Record<string, unknown> = {};
    if (f.status && f.status !== "all") q.status = f.status;
    if (f.group && f.group !== "all") q.group = f.group;
    if (f.before) q.createdAt = { $lt: f.before };
    const rows = await PushOutboxModel.find(q).sort({ createdAt: -1 }).limit(51).lean<Doc[]>();
    const view = rows.slice(0, 50).map((d): PushRowView => ({
      id: String(d._id), key: d.key as string, customerId: d.customerId as string, group: d.group as PushGroup, kind: d.kind as string, title: d.title as string, body: (d.body as string) ?? "",
      status: d.status as PushRowView["status"], reason: (d.reason as string) ?? null, attempts: (d.attempts as number) ?? 0,
      devices: ((d.tickets as unknown[]) ?? []).length, delivered: (d.delivered as number) ?? 0, createdAt: d.createdAt as string, sentAt: (d.sentAt as string) ?? null,
    }));
    return {
      devices: { active, customers, disabled },
      last24h: Object.fromEntries((byStatus as { _id: string; n: number }[]).map((x) => [x._id, x.n])),
      reasons: Object.fromEntries((byReason as { _id: string | null; n: number }[]).map((x) => [x._id ?? "unknown", x.n])),
      rows: view, nextBefore: rows.length > 50 ? view[view.length - 1].createdAt : null,
      expoTokenSet: Boolean(process.env.EXPO_ACCESS_TOKEN?.trim()),
    };
  },

  /** Admin: send a test notification to one customer (by id or phone). Ignores quiet hours. */
  async adminTest(input: { customerId?: string; phone?: string; title: string; body: string; url?: string }, adminName: string): Promise<Result<{ queued: boolean; devices: number; customerId: string }>> {
    let customerId = input.customerId?.trim() ?? "";
    if (!customerId && input.phone) {
      const { CustomerModel } = await import("@/modules/customers/customer.model");
      const digits = input.phone.replace(/\D/g, "").slice(-10);
      const c = await CustomerModel.findOne({ phone: { $regex: `${digits}$` } }).select("_id").lean<Doc>();
      customerId = c ? String(c._id) : "";
    }
    if (!/^[a-f0-9]{24}$/i.test(customerId)) return fail(AppErrors.notFound("Customer not found"));
    const { PushDeviceModel } = await M();
    const devices = await PushDeviceModel.countDocuments({ customerId, active: true });
    const n = await queue({ customerId, key: `test:${crypto.randomUUID()}`, group: "chat", kind: "admin_test", title: input.title, body: input.body, url: input.url || "/notifications", urgent: true, inbox: true, ttlSec: 3600 });
    await auditService.record({ action: "create", entity: "settings", entityId: customerId, entityLabel: "Test push", summary: `Test push to customer ${customerId} (${devices} device${devices === 1 ? "" : "s"}): ${input.title}`, actor: adminName }).catch(() => undefined);
    return ok({ queued: n > 0, devices, customerId });
  },
};
