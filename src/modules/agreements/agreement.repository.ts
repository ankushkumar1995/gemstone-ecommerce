import "server-only";

/**
 * Partner agreements — repository (mock or Mongo via dataSourceFor).
 *
 * Correctness that must hold under concurrency lives here, not in callers:
 *  • a draft is edited / published / deleted only while it is still a draft
 *  • one live (non-void) signature per partner + version (unique index)
 *  • an OTP attempt is counted atomically, and a challenge is consumed once
 */

import { dataSourceFor } from "@/core/config/env";
import { newId } from "@/core/id";
import { contentHashOf } from "./agreement.crypto";
import { DEFAULT_AGREEMENT } from "./agreement.default";
import type {
  AgreementAcceptance, AgreementActivity, AgreementExtension, AgreementVersion, OtpChallenge,
} from "./agreement.types";

export const MAX_OTP_ATTEMPTS = 3;

type NewVersion = Omit<AgreementVersion, "id" | "createdAt" | "updatedAt">;
type DraftPatch = Partial<Pick<AgreementVersion, "version" | "title" | "changes" | "clauses" | "keyPoints" | "effectiveFrom" | "signDeadline">>;

export interface AgreementRepository {
  listVersions(): Promise<AgreementVersion[]>;
  getVersion(id: string): Promise<AgreementVersion | null>;
  versionTaken(version: string, exceptId?: string): Promise<boolean>;
  currentPublished(): Promise<AgreementVersion | null>;
  createVersion(v: NewVersion): Promise<AgreementVersion | "duplicate">;
  updateDraft(id: string, patch: DraftPatch, activity: AgreementActivity): Promise<AgreementVersion | null | "duplicate">;
  deleteDraft(id: string): Promise<boolean>;
  publish(id: string, p: { contentHash: string; publishedAt: string; publishedBy: string; activity: AgreementActivity }): Promise<AgreementVersion | null>;
  /** Retire every other published version published before `before`. */
  retireOlder(exceptId: string, before: string, activity: AgreementActivity): Promise<number>;
  pushActivity(id: string, activity: AgreementActivity): Promise<void>;

  createAcceptance(a: Omit<AgreementAcceptance, "id">): Promise<AgreementAcceptance | "duplicate">;
  getAcceptance(id: string): Promise<AgreementAcceptance | null>;
  activeAcceptance(astrologerId: string, agreementId: string): Promise<AgreementAcceptance | null>;
  acceptancesForPartner(astrologerId: string): Promise<AgreementAcceptance[]>;
  acceptancesForAgreement(agreementId: string): Promise<AgreementAcceptance[]>;
  signedCounts(): Promise<Record<string, number>>;
  voidAcceptance(id: string, v: { voidedAt: string; voidedBy: string; voidReason: string }): Promise<AgreementAcceptance | null>;
  /** Write-once: records the archived PDF only if none is set yet. */
  setPdf(id: string, pdf: NonNullable<AgreementAcceptance["pdf"]>): Promise<boolean>;

  createOtp(c: Omit<OtpChallenge, "id">, purgeAt: string): Promise<OtpChallenge>;
  getOtp(id: string): Promise<OtpChallenge | null>;
  recentOtps(astrologerId: string, since: string): Promise<OtpChallenge[]>;
  /** +1 attempt if still usable (not consumed, not locked, under the cap). */
  registerAttempt(id: string): Promise<OtpChallenge | null>;
  lockOtp(id: string, until: string): Promise<void>;
  /** Mark used exactly once. False if already consumed. */
  consumeOtp(id: string, at: string): Promise<boolean>;
  /** Close any open challenge for this partner (a new one replaces it). */
  closeOpenOtps(astrologerId: string, at: string): Promise<void>;

  getExtension(agreementId: string, astrologerId: string): Promise<AgreementExtension | null>;
  listExtensions(agreementId: string): Promise<AgreementExtension[]>;
  upsertExtension(e: Omit<AgreementExtension, "id">): Promise<AgreementExtension>;
  deleteExtension(agreementId: string, astrologerId: string): Promise<boolean>;
}

const byPublishedDesc = (a: AgreementVersion, b: AgreementVersion) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
const iso = (d: unknown): string | null => (d instanceof Date ? d.toISOString() : typeof d === "string" ? d : null);
const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ *
 * Mock (in-memory, survives hot reload). Seeded with the default text as
 * a published version so the panel works without a database.
 * ------------------------------------------------------------------ */

interface MockDb {
  versions: AgreementVersion[];
  acceptances: AgreementAcceptance[];
  otps: (OtpChallenge & { purgeAt: string })[];
  extensions: AgreementExtension[];
}
declare global { var __agreementMem: MockDb | undefined }

function seedMock(): MockDb {
  const at = now();
  const v: AgreementVersion = {
    id: newId("agr"), ...DEFAULT_AGREEMENT, status: "published",
    contentHash: contentHashOf(DEFAULT_AGREEMENT), publishedAt: at, publishedBy: "System", retiredAt: null,
    createdAt: at, updatedAt: at, createdBy: "System",
    activity: [{ at, actor: "System", action: "Published (seed)" }],
  };
  return { versions: [v], acceptances: [], otps: [], extensions: [] };
}
const mem: MockDb = global.__agreementMem ?? seedMock();
global.__agreementMem = mem;
const copy = <T,>(x: T): T => structuredClone(x);

const mockRepo: AgreementRepository = {
  async listVersions() { return copy([...mem.versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))); },
  async getVersion(id) { const v = mem.versions.find((x) => x.id === id); return v ? copy(v) : null; },
  async versionTaken(version, exceptId) { return mem.versions.some((x) => x.version === version && x.id !== exceptId); },
  async currentPublished() { const v = mem.versions.filter((x) => x.status === "published").sort(byPublishedDesc)[0]; return v ? copy(v) : null; },
  async createVersion(v) {
    if (mem.versions.some((x) => x.version === v.version)) return "duplicate";
    const at = now();
    const row: AgreementVersion = { ...copy(v), id: newId("agr"), createdAt: at, updatedAt: at };
    mem.versions.push(row);
    return copy(row);
  },
  async updateDraft(id, patch, activity) {
    const v = mem.versions.find((x) => x.id === id);
    if (!v || v.status !== "draft") return null;
    if (patch.version && mem.versions.some((x) => x.version === patch.version && x.id !== id)) return "duplicate";
    Object.assign(v, copy(patch), { updatedAt: now(), activity: [activity, ...v.activity].slice(0, 200) });
    return copy(v);
  },
  async deleteDraft(id) {
    const i = mem.versions.findIndex((x) => x.id === id && x.status === "draft");
    if (i < 0) return false;
    mem.versions.splice(i, 1);
    return true;
  },
  async publish(id, p) {
    const v = mem.versions.find((x) => x.id === id);
    if (!v || v.status !== "draft") return null;
    Object.assign(v, { status: "published", contentHash: p.contentHash, publishedAt: p.publishedAt, publishedBy: p.publishedBy, updatedAt: now(), activity: [p.activity, ...v.activity] });
    return copy(v);
  },
  async retireOlder(exceptId, before, activity) {
    let n = 0;
    for (const v of mem.versions) {
      if (v.id !== exceptId && v.status === "published" && (v.publishedAt ?? "") < before) {
        Object.assign(v, { status: "retired", retiredAt: activity.at, updatedAt: activity.at, activity: [activity, ...v.activity] });
        n++;
      }
    }
    return n;
  },
  async pushActivity(id, activity) { const v = mem.versions.find((x) => x.id === id); if (v) v.activity = [activity, ...v.activity].slice(0, 200); },

  async createAcceptance(a) {
    if (mem.acceptances.some((x) => x.astrologerId === a.astrologerId && x.agreementId === a.agreementId && !x.voided)) return "duplicate";
    if (mem.acceptances.some((x) => x.certificateNo === a.certificateNo)) return "duplicate";
    const row: AgreementAcceptance = { ...copy(a), id: newId("ags") };
    mem.acceptances.push(row);
    return copy(row);
  },
  async getAcceptance(id) { const a = mem.acceptances.find((x) => x.id === id); return a ? copy(a) : null; },
  async activeAcceptance(astrologerId, agreementId) { const a = mem.acceptances.find((x) => x.astrologerId === astrologerId && x.agreementId === agreementId && !x.voided); return a ? copy(a) : null; },
  async acceptancesForPartner(astrologerId) { return copy(mem.acceptances.filter((x) => x.astrologerId === astrologerId).sort((a, b) => b.signedAt.localeCompare(a.signedAt))); },
  async acceptancesForAgreement(agreementId) { return copy(mem.acceptances.filter((x) => x.agreementId === agreementId).sort((a, b) => b.signedAt.localeCompare(a.signedAt))); },
  async signedCounts() {
    const out: Record<string, number> = {};
    for (const a of mem.acceptances) if (!a.voided) out[a.agreementId] = (out[a.agreementId] ?? 0) + 1;
    return out;
  },
  async voidAcceptance(id, v) {
    const a = mem.acceptances.find((x) => x.id === id);
    if (!a || a.voided) return null;
    Object.assign(a, { voided: true, ...v });
    return copy(a);
  },
  async setPdf(id, pdf) {
    const a = mem.acceptances.find((x) => x.id === id);
    if (!a || a.pdf) return false;
    a.pdf = { ...pdf };
    return true;
  },

  async createOtp(c, purgeAt) { const row = { ...copy(c), id: newId("otp"), purgeAt }; mem.otps.push(row); return copy(row); },
  async getOtp(id) { const o = mem.otps.find((x) => x.id === id); return o ? copy(o) : null; },
  async recentOtps(astrologerId, since) { return copy(mem.otps.filter((x) => x.astrologerId === astrologerId && x.createdAt >= since).sort((a, b) => b.createdAt.localeCompare(a.createdAt))); },
  async registerAttempt(id) {
    const o = mem.otps.find((x) => x.id === id);
    if (!o || o.consumedAt || o.lockedUntil || o.attempts >= MAX_OTP_ATTEMPTS) return null;
    o.attempts += 1;
    return copy(o);
  },
  async lockOtp(id, until) { const o = mem.otps.find((x) => x.id === id); if (o) { o.lockedUntil = until; o.consumedAt = o.consumedAt ?? now(); } },
  async consumeOtp(id, at) { const o = mem.otps.find((x) => x.id === id); if (!o || o.consumedAt) return false; o.consumedAt = at; return true; },
  async closeOpenOtps(astrologerId, at) { for (const o of mem.otps) if (o.astrologerId === astrologerId && !o.consumedAt) o.consumedAt = at; },

  async getExtension(agreementId, astrologerId) { const e = mem.extensions.find((x) => x.agreementId === agreementId && x.astrologerId === astrologerId); return e ? copy(e) : null; },
  async listExtensions(agreementId) { return copy(mem.extensions.filter((x) => x.agreementId === agreementId)); },
  async upsertExtension(e) {
    const i = mem.extensions.findIndex((x) => x.agreementId === e.agreementId && x.astrologerId === e.astrologerId);
    const row: AgreementExtension = { ...copy(e), id: i >= 0 ? mem.extensions[i].id : newId("agx") };
    if (i >= 0) mem.extensions[i] = row; else mem.extensions.push(row);
    return copy(row);
  },
  async deleteExtension(agreementId, astrologerId) {
    const i = mem.extensions.findIndex((x) => x.agreementId === agreementId && x.astrologerId === astrologerId);
    if (i < 0) return false;
    mem.extensions.splice(i, 1);
    return true;
  },
};

/* ------------------------------------------------------------------ *
 * Mongo
 * ------------------------------------------------------------------ */

type Row = Record<string, unknown> & { _id: unknown };
const isOid = (id: string) => /^[a-f0-9]{24}$/i.test(id);
const isDup = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: number }).code === 11000;

async function models() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return import("./agreement.model");
}

const toActivity = (a: Row): AgreementActivity => ({ at: iso(a.at) ?? now(), actor: String(a.actor), action: String(a.action), ...(a.note ? { note: String(a.note) } : {}) });
const actDoc = (a: AgreementActivity) => ({ ...a, at: new Date(a.at) });

function toVersion(d: Row): AgreementVersion {
  return {
    id: String(d._id),
    version: String(d.version),
    title: String(d.title),
    status: d.status as AgreementVersion["status"],
    changes: (d.changes as string[]) ?? [],
    clauses: ((d.clauses as Row[]) ?? []).map((c) => ({ id: String(c.id), heading: String(c.heading), body: String(c.body) })),
    keyPoints: ((d.keyPoints as Row[]) ?? []).map((k) => ({ id: String(k.id), text: String(k.text) })),
    effectiveFrom: iso(d.effectiveFrom) ?? now(),
    signDeadline: iso(d.signDeadline) ?? now(),
    contentHash: (d.contentHash as string | null) ?? null,
    publishedAt: iso(d.publishedAt),
    publishedBy: (d.publishedBy as string | null) ?? null,
    retiredAt: iso(d.retiredAt),
    createdAt: iso(d.createdAt) ?? now(),
    updatedAt: iso(d.updatedAt) ?? now(),
    createdBy: String(d.createdBy ?? "System"),
    activity: ((d.activity as Row[]) ?? []).map(toActivity),
  };
}

function toAcceptance(d: Row): AgreementAcceptance {
  const signer = (d.signer ?? {}) as Row;
  const otp = (d.otp ?? {}) as Row;
  const ev = (d.evidence ?? {}) as Row;
  return {
    id: String(d._id),
    certificateNo: String(d.certificateNo),
    astrologerId: String(d.astrologerId),
    agreementId: String(d.agreementId),
    version: String(d.version),
    contentHash: String(d.contentHash),
    signer: { legalName: String(signer.legalName ?? ""), displayName: String(signer.displayName ?? ""), email: String(signer.email ?? ""), phoneMasked: String(signer.phoneMasked ?? "") },
    typedName: String(d.typedName),
    method: d.method as AgreementAcceptance["method"],
    otp: { challengeId: String(otp.challengeId ?? ""), channel: (otp.channel as AgreementAcceptance["otp"]["channel"]) ?? "sms", destinationMasked: String(otp.destinationMasked ?? ""), delivered: Boolean(otp.delivered) },
    keyPointsAccepted: (d.keyPointsAccepted as string[]) ?? [],
    signedAt: iso(d.signedAt) ?? now(),
    ip: String(d.ip ?? ""),
    ipMasked: String(d.ipMasked ?? ""),
    userAgent: String(d.userAgent ?? ""),
    device: String(d.device ?? ""),
    evidence: { scrolledToEnd: Boolean(ev.scrolledToEnd), secondsOnPage: Number(ev.secondsOnPage ?? 0) },
    fingerprint: String(d.fingerprint),
    prevFingerprint: (d.prevFingerprint as string | null) ?? null,
    voided: Boolean(d.voided),
    voidedAt: iso(d.voidedAt),
    voidedBy: (d.voidedBy as string | null) ?? null,
    voidReason: (d.voidReason as string | null) ?? null,
    pdf: d.pdf && (d.pdf as Row).key
      ? { key: String((d.pdf as Row).key), sha256: String((d.pdf as Row).sha256 ?? ""), bytes: Number((d.pdf as Row).bytes ?? 0), storedAt: iso((d.pdf as Row).storedAt) ?? now() }
      : null,
  };
}

function toOtp(d: Row): OtpChallenge {
  return {
    id: String(d._id),
    astrologerId: String(d.astrologerId),
    agreementId: String(d.agreementId),
    contentHash: String(d.contentHash),
    codeHash: String(d.codeHash),
    channel: d.channel as OtpChallenge["channel"],
    destinationMasked: String(d.destinationMasked),
    delivered: Boolean(d.delivered),
    createdAt: iso(d.createdAt) ?? now(),
    expiresAt: iso(d.expiresAt) ?? now(),
    attempts: Number(d.attempts ?? 0),
    lockedUntil: iso(d.lockedUntil),
    consumedAt: iso(d.consumedAt),
    ip: String(d.ip ?? ""),
  };
}

const toExtension = (d: Row): AgreementExtension => ({
  id: String(d._id), agreementId: String(d.agreementId), astrologerId: String(d.astrologerId),
  until: iso(d.until) ?? now(), reason: String(d.reason), grantedBy: String(d.grantedBy), grantedAt: iso(d.grantedAt) ?? now(),
});

const datesOf = (p: DraftPatch) => ({
  ...p,
  ...(p.effectiveFrom ? { effectiveFrom: new Date(p.effectiveFrom) } : {}),
  ...(p.signDeadline ? { signDeadline: new Date(p.signDeadline) } : {}),
});

const mongoRepo: AgreementRepository = {
  async listVersions() { const { AgreementModel: M } = await models(); return (await M.find().sort({ createdAt: -1 }).lean<Row[]>()).map(toVersion); },
  async getVersion(id) { if (!isOid(id)) return null; const { AgreementModel: M } = await models(); const d = await M.findById(id).lean<Row>(); return d ? toVersion(d) : null; },
  async versionTaken(version, exceptId) {
    const { AgreementModel: M } = await models();
    return Boolean(await M.exists({ version, ...(exceptId && isOid(exceptId) ? { _id: { $ne: exceptId } } : {}) }));
  },
  async currentPublished() { const { AgreementModel: M } = await models(); const d = await M.findOne({ status: "published" }).sort({ publishedAt: -1 }).lean<Row>(); return d ? toVersion(d) : null; },
  async createVersion(v) {
    const { AgreementModel: M } = await models();
    try {
      const d = await M.create({ ...v, effectiveFrom: new Date(v.effectiveFrom), signDeadline: new Date(v.signDeadline), publishedAt: v.publishedAt ? new Date(v.publishedAt) : null, retiredAt: v.retiredAt ? new Date(v.retiredAt) : null, activity: v.activity.map(actDoc) });
      return toVersion(d.toObject() as Row);
    } catch (e) { if (isDup(e)) return "duplicate"; throw e; }
  },
  async updateDraft(id, patch, activity) {
    if (!isOid(id)) return null;
    const { AgreementModel: M } = await models();
    try {
      const d = await M.findOneAndUpdate(
        { _id: id, status: "draft" },
        { $set: datesOf(patch), $push: { activity: { $each: [actDoc(activity)], $position: 0, $slice: 200 } } },
        { returnDocument: "after", runValidators: true },
      ).lean<Row>();
      return d ? toVersion(d) : null;
    } catch (e) { if (isDup(e)) return "duplicate"; throw e; }
  },
  async deleteDraft(id) { if (!isOid(id)) return false; const { AgreementModel: M } = await models(); return (await M.deleteOne({ _id: id, status: "draft" })).deletedCount === 1; },
  async publish(id, p) {
    if (!isOid(id)) return null;
    const { AgreementModel: M } = await models();
    const d = await M.findOneAndUpdate(
      { _id: id, status: "draft" },
      { $set: { status: "published", contentHash: p.contentHash, publishedAt: new Date(p.publishedAt), publishedBy: p.publishedBy }, $push: { activity: { $each: [actDoc(p.activity)], $position: 0 } } },
      { returnDocument: "after" },
    ).lean<Row>();
    return d ? toVersion(d) : null;
  },
  async retireOlder(exceptId, before, activity) {
    const { AgreementModel: M } = await models();
    const r = await M.updateMany(
      { _id: { $ne: exceptId }, status: "published", publishedAt: { $lt: new Date(before) } },
      { $set: { status: "retired", retiredAt: new Date(activity.at) }, $push: { activity: { $each: [actDoc(activity)], $position: 0 } } },
    );
    return r.modifiedCount;
  },
  async pushActivity(id, activity) {
    if (!isOid(id)) return;
    const { AgreementModel: M } = await models();
    await M.updateOne({ _id: id }, { $push: { activity: { $each: [actDoc(activity)], $position: 0, $slice: 200 } } });
  },

  async createAcceptance(a) {
    const { AcceptanceModel: M } = await models();
    try {
      const d = await M.create({ ...a, signedAt: new Date(a.signedAt), voidedAt: a.voidedAt ? new Date(a.voidedAt) : null });
      return toAcceptance(d.toObject() as Row);
    } catch (e) { if (isDup(e)) return "duplicate"; throw e; }
  },
  async getAcceptance(id) { if (!isOid(id)) return null; const { AcceptanceModel: M } = await models(); const d = await M.findById(id).lean<Row>(); return d ? toAcceptance(d) : null; },
  async activeAcceptance(astrologerId, agreementId) { const { AcceptanceModel: M } = await models(); const d = await M.findOne({ astrologerId, agreementId, voided: false }).lean<Row>(); return d ? toAcceptance(d) : null; },
  async acceptancesForPartner(astrologerId) { const { AcceptanceModel: M } = await models(); return (await M.find({ astrologerId }).sort({ signedAt: -1 }).lean<Row[]>()).map(toAcceptance); },
  async acceptancesForAgreement(agreementId) { const { AcceptanceModel: M } = await models(); return (await M.find({ agreementId }).sort({ signedAt: -1 }).lean<Row[]>()).map(toAcceptance); },
  async signedCounts() {
    const { AcceptanceModel: M } = await models();
    const rows = await M.aggregate<{ _id: string; n: number }>([{ $match: { voided: false } }, { $group: { _id: "$agreementId", n: { $sum: 1 } } }]);
    return Object.fromEntries(rows.map((r) => [r._id, r.n]));
  },
  async voidAcceptance(id, v) {
    if (!isOid(id)) return null;
    const { AcceptanceModel: M } = await models();
    const d = await M.findOneAndUpdate({ _id: id, voided: false }, { $set: { voided: true, voidedAt: new Date(v.voidedAt), voidedBy: v.voidedBy, voidReason: v.voidReason } }, { returnDocument: "after" }).lean<Row>();
    return d ? toAcceptance(d) : null;
  },
  async setPdf(id, pdf) {
    if (!isOid(id)) return false;
    const { AcceptanceModel: M } = await models();
    const r = await M.updateOne({ _id: id, pdf: null }, { $set: { pdf: { ...pdf, storedAt: new Date(pdf.storedAt) } } });
    return r.modifiedCount === 1;
  },

  async createOtp(c, purgeAt) {
    const { OtpModel: M } = await models();
    const d = await M.create({ ...c, createdAt: new Date(c.createdAt), expiresAt: new Date(c.expiresAt), lockedUntil: null, consumedAt: null, purgeAt: new Date(purgeAt) });
    return toOtp(d.toObject() as Row);
  },
  async getOtp(id) { if (!isOid(id)) return null; const { OtpModel: M } = await models(); const d = await M.findById(id).lean<Row>(); return d ? toOtp(d) : null; },
  async recentOtps(astrologerId, since) { const { OtpModel: M } = await models(); return (await M.find({ astrologerId, createdAt: { $gte: new Date(since) } }).sort({ createdAt: -1 }).lean<Row[]>()).map(toOtp); },
  async registerAttempt(id) {
    if (!isOid(id)) return null;
    const { OtpModel: M } = await models();
    const d = await M.findOneAndUpdate(
      { _id: id, consumedAt: null, lockedUntil: null, attempts: { $lt: MAX_OTP_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" },
    ).lean<Row>();
    return d ? toOtp(d) : null;
  },
  async lockOtp(id, until) {
    if (!isOid(id)) return;
    const { OtpModel: M } = await models();
    const u = new Date(until);
    await M.updateOne({ _id: id }, { $set: { lockedUntil: u, consumedAt: new Date(), purgeAt: new Date(u.getTime() + 3600_000) } });
  },
  async consumeOtp(id, at) {
    if (!isOid(id)) return false;
    const { OtpModel: M } = await models();
    return (await M.updateOne({ _id: id, consumedAt: null }, { $set: { consumedAt: new Date(at) } })).modifiedCount === 1;
  },
  async closeOpenOtps(astrologerId, at) {
    const { OtpModel: M } = await models();
    await M.updateMany({ astrologerId, consumedAt: null }, { $set: { consumedAt: new Date(at) } });
  },

  async getExtension(agreementId, astrologerId) { const { ExtensionModel: M } = await models(); const d = await M.findOne({ agreementId, astrologerId }).lean<Row>(); return d ? toExtension(d) : null; },
  async listExtensions(agreementId) { const { ExtensionModel: M } = await models(); return (await M.find({ agreementId }).lean<Row[]>()).map(toExtension); },
  async upsertExtension(e) {
    const { ExtensionModel: M } = await models();
    const d = await M.findOneAndUpdate(
      { agreementId: e.agreementId, astrologerId: e.astrologerId },
      { $set: { until: new Date(e.until), reason: e.reason, grantedBy: e.grantedBy, grantedAt: new Date(e.grantedAt) } },
      { upsert: true, returnDocument: "after" },
    ).lean<Row>();
    return toExtension(d as Row);
  },
  async deleteExtension(agreementId, astrologerId) { const { ExtensionModel: M } = await models(); return (await M.deleteOne({ agreementId, astrologerId })).deletedCount === 1; },
};

export function getAgreementRepository(): AgreementRepository {
  return dataSourceFor("agreements") === "mongo" ? mongoRepo : mockRepo;
}
