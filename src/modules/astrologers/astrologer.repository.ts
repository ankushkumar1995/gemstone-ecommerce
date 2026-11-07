/**
 * Astrologers domain — repository.
 *
 *  • mock  — in-memory (lost on restart; good for local UI work).
 *  • mongo — Mongoose model, soft-delete aware.
 *
 * Switch with DATA_SOURCE_ASTROLOGERS=mongo.
 *
 * Profile data and secrets are deliberately separate: `findById` etc. never
 * return password/refresh hashes or full bank/PAN numbers. Those are only
 * reachable through the explicit `getAuth*` / `*Secrets` methods.
 */

import { dataSourceFor } from "@/core/config/env";
import type { Astrologer, AstrologerListFilter } from "./astrologer.types";
import type { AstrologerDoc } from "./astrologer.model";

export interface AuthSecrets {
  passwordHash: string | null;
  tokenVersion: number;
  refreshTokenHash: string | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  passwordResetTokenHash: string | null;
  passwordResetExpires: Date | null;
}
export interface FinancialSecrets {
  panNumber: string | null;
  payoutAccountNumber: string | null;
}

export interface AstrologerRepository {
  findAll(filter?: AstrologerListFilter): Promise<Astrologer[]>;
  findById(id: string): Promise<Astrologer | null>;
  findBySlug(slug: string): Promise<Astrologer | null>;
  findByEmail(email: string): Promise<Astrologer | null>;
  emailTaken(email: string, exceptId?: string): Promise<boolean>;
  slugTaken(slug: string, exceptId?: string): Promise<boolean>;
  create(a: Astrologer, auth: Pick<AuthSecrets, "passwordHash">): Promise<Astrologer>;
  update(id: string, patch: Partial<Astrologer>): Promise<Astrologer | null>;
  remove(id: string): Promise<boolean>;
  getAuth(id: string): Promise<AuthSecrets | null>;
  setAuth(id: string, patch: Partial<AuthSecrets>): Promise<void>;
  bumpTokenVersion(id: string): Promise<void>;
  findIdByResetHash(hash: string): Promise<string | null>;
  getFinancial(id: string): Promise<FinancialSecrets | null>;
  setFinancial(id: string, patch: Partial<FinancialSecrets>): Promise<void>;
}

const matchesFilter = (a: Astrologer, f?: AstrologerListFilter) => {
  if (!f) return true;
  if (f.status) {
    const list = Array.isArray(f.status) ? f.status : [f.status];
    if (!list.includes(a.status)) return false;
  }
  if (f.q) {
    const q = f.q.toLowerCase();
    if (![a.displayName, a.legalName, a.email, a.phone, a.city ?? ""].some((v) => v.toLowerCase().includes(q))) return false;
  }
  return true;
};

/* ------------------------------------------------------------------ *
 * Mock
 * ------------------------------------------------------------------ */
declare global {
  var __astroStore: { rows: Astrologer[]; auth: Map<string, AuthSecrets>; fin: Map<string, FinancialSecrets> } | undefined;
}
const mem = global.__astroStore ?? { rows: [], auth: new Map<string, AuthSecrets>(), fin: new Map<string, FinancialSecrets>() };
global.__astroStore = mem;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const emptyAuth = (): AuthSecrets => ({ passwordHash: null, tokenVersion: 0, refreshTokenHash: null, failedLoginCount: 0, lockedUntil: null, passwordResetTokenHash: null, passwordResetExpires: null });

const mockRepo: AstrologerRepository = {
  async findAll(f) { return mem.rows.filter((a) => matchesFilter(a, f)).map(clone); },
  async findById(id) { const a = mem.rows.find((x) => x.id === id); return a ? clone(a) : null; },
  async findBySlug(slug) { const a = mem.rows.find((x) => x.slug === slug.toLowerCase()); return a ? clone(a) : null; },
  async findByEmail(email) { const a = mem.rows.find((x) => x.email === email.toLowerCase()); return a ? clone(a) : null; },
  async emailTaken(email, exceptId) { return mem.rows.some((x) => x.email === email.toLowerCase() && x.id !== exceptId); },
  async slugTaken(slug, exceptId) { return mem.rows.some((x) => x.slug === slug && x.id !== exceptId); },
  async create(a, auth) {
    mem.rows.unshift(clone(a));
    mem.auth.set(a.id, { ...emptyAuth(), passwordHash: auth.passwordHash });
    mem.fin.set(a.id, { panNumber: null, payoutAccountNumber: null });
    return clone(a);
  },
  async update(id, patch) {
    const i = mem.rows.findIndex((x) => x.id === id);
    if (i === -1) return null;
    // A key explicitly set to undefined means "clear it" (same as the Mongo repo),
    // so apply keys one by one instead of a JSON clone (which drops undefined keys).
    const row: Record<string, unknown> = { ...mem.rows[i] };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete row[k];
      else row[k] = clone(v);
    }
    row.updatedAt = new Date().toISOString();
    mem.rows[i] = row as unknown as Astrologer;
    return clone(mem.rows[i]);
  },
  async remove(id) {
    const i = mem.rows.findIndex((x) => x.id === id);
    if (i === -1) return false;
    mem.rows.splice(i, 1);
    return true;
  },
  async getAuth(id) { const s = mem.auth.get(id); return s ? { ...s } : null; },
  async setAuth(id, patch) { mem.auth.set(id, { ...(mem.auth.get(id) ?? emptyAuth()), ...patch }); },
  async bumpTokenVersion(id) { const s = mem.auth.get(id) ?? emptyAuth(); mem.auth.set(id, { ...s, tokenVersion: s.tokenVersion + 1, refreshTokenHash: null }); },
  async findIdByResetHash(hash) {
    for (const [id, s] of mem.auth) if (s.passwordResetTokenHash === hash && s.passwordResetExpires && s.passwordResetExpires.getTime() > Date.now()) return id;
    return null;
  },
  async getFinancial(id) { const s = mem.fin.get(id); return s ? { ...s } : null; },
  async setFinancial(id, patch) { mem.fin.set(id, { ...(mem.fin.get(id) ?? { panNumber: null, payoutAccountNumber: null }), ...patch }); },
};

/* ------------------------------------------------------------------ *
 * Mongo
 * ------------------------------------------------------------------ */
async function M() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  const { AstrologerModel } = await import("./astrologer.model");
  await connectMongoose();
  return AstrologerModel;
}
const notDeleted = { isDeleted: { $ne: true } };
const isObjectId = (id: string) => /^[a-f0-9]{24}$/i.test(id);
const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : typeof d === "string" ? d : undefined);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function fromDoc(d: AstrologerDoc): Astrologer {
  const x = d as unknown as Record<string, unknown> & AstrologerDoc;
  const p = (d.presence ?? {}) as NonNullable<AstrologerDoc["presence"]>;
  const s = (d.stats ?? {}) as NonNullable<AstrologerDoc["stats"]>;
  return {
    id: String(d._id),
    slug: d.slug,
    displayName: d.displayName,
    legalName: d.legalName,
    email: d.email,
    phone: d.phone,
    gender: (d.gender ?? undefined) as Astrologer["gender"],
    city: d.city ?? undefined,
    state: d.state ?? undefined,
    photo: d.photo ?? undefined,
    shortBio: d.shortBio ?? undefined,
    bio: d.bio ?? undefined,
    languages: d.languages ?? [],
    expertise: d.expertise ?? [],
    categories: d.categories ?? [],
    experienceYears: d.experienceYears ?? 0,
    education: d.education ?? undefined,
    certifications: d.certifications ?? undefined,
    rates: { chat: d.rates?.chat ?? 0, call: d.rates?.call ?? 0, video: d.rates?.video ?? 0 },
    availability: (d.availability ?? []).map((a) => ({ day: a.day as Astrologer["availability"][number]["day"], start: a.start, end: a.end })),
    timezone: d.timezone ?? "Asia/Kolkata",
    status: d.status as Astrologer["status"],
    statusReason: d.statusReason ?? undefined,
    statusChangedAt: d.statusChangedAt ?? undefined,
    appliedAt: d.appliedAt,
    approvedAt: d.approvedAt ?? undefined,
    approvedBy: d.approvedBy ?? undefined,
    source: (d.source ?? "self") as Astrologer["source"],
    kyc: (d.kyc ?? []).map((k) => ({
      type: k.type as Astrologer["kyc"][number]["type"], fileKey: k.fileKey ?? undefined, fileName: k.fileName ?? undefined,
      numberMasked: k.numberMasked ?? undefined, status: k.status as Astrologer["kyc"][number]["status"], note: k.note ?? undefined,
      uploadedAt: k.uploadedAt, reviewedAt: k.reviewedAt ?? undefined, reviewedBy: k.reviewedBy ?? undefined,
    })),
    payout: d.payout
      ? {
          method: (d.payout.method ?? "bank") as "bank" | "upi", accountHolder: d.payout.accountHolder ?? undefined,
          accountNumberMasked: d.payout.accountNumberMasked ?? undefined, ifsc: d.payout.ifsc ?? undefined,
          bankName: d.payout.bankName ?? undefined, upiId: d.payout.upiId ?? undefined, verified: Boolean(d.payout.verified),
        }
      : undefined,
    presence: {
      online: Boolean(p.online),
      channels: { chat: p.channels?.chat ?? true, call: p.channels?.call ?? false, video: p.channels?.video ?? false },
      busyWith: p.busyWith ?? undefined,
      lastHeartbeatAt: p.lastHeartbeatAt ?? undefined,
      onlineSince: p.onlineSince ?? undefined,
    },
    stats: {
      rating: s.rating ?? 0, reviewCount: s.reviewCount ?? 0, totalSessions: s.totalSessions ?? 0, totalMinutes: s.totalMinutes ?? 0,
      missedRequests: s.missedRequests ?? 0, missedStreak: s.missedStreak ?? 0, repeatCustomers: s.repeatCustomers ?? 0,
    },
    commissionPct: d.commissionPct ?? null,
    maxRate: d.maxRate ?? null,
    featured: Boolean(d.featured),
    sortWeight: d.sortWeight ?? 0,
    badges: (d.badges ?? []) as Astrologer["badges"],
    hidden: Boolean(d.hidden),
    pendingChanges: d.pendingChanges
      ? { displayName: d.pendingChanges.displayName ?? undefined, photo: d.pendingChanges.photo ?? undefined, shortBio: d.pendingChanges.shortBio ?? undefined, bio: d.pendingChanges.bio ?? undefined, submittedAt: d.pendingChanges.submittedAt }
      : undefined,
    adminNotes: d.adminNotes ?? undefined,
    mustChangePassword: Boolean(d.mustChangePassword),
    lastLoginAt: d.lastLoginAt ?? undefined,
    activity: (d.activity ?? []).map((a) => ({ id: a.id, at: a.at, type: a.type as Astrologer["activity"][number]["type"], message: a.message, actor: a.actor ?? undefined })),
    createdAt: iso(x.createdAt) ?? d.appliedAt,
    updatedAt: iso(x.updatedAt) ?? d.appliedAt,
  };
}

/** Strip computed / immutable fields before writing. */
function toDoc(p: Partial<Astrologer>): Record<string, unknown> {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = p;
  void _id; void _c; void _u;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) if (v !== undefined) out[k] = v;
  // Explicit clears (undefined → remove) for optional sub-documents.
  if ("pendingChanges" in p && p.pendingChanges === undefined) out.pendingChanges = null;
  if ("statusReason" in p && p.statusReason === undefined) out.statusReason = null;
  return out;
}

const mongoRepo: AstrologerRepository = {
  async findAll(f) {
    const m = await M();
    const q: Record<string, unknown> = { ...notDeleted };
    if (f?.status) q.status = Array.isArray(f.status) ? { $in: f.status } : f.status;
    if (f?.q) {
      const re = new RegExp(escapeRe(f.q), "i");
      q.$or = [{ displayName: re }, { legalName: re }, { email: re }, { phone: re }, { city: re }];
    }
    const docs = await m.find(q).sort({ createdAt: -1 }).lean<AstrologerDoc[]>();
    return docs.map(fromDoc);
  },
  async findById(id) {
    if (!isObjectId(id)) return null;
    const m = await M();
    const d = await m.findOne({ _id: id, ...notDeleted }).lean<AstrologerDoc>();
    return d ? fromDoc(d) : null;
  },
  async findBySlug(slug) {
    const m = await M();
    const d = await m.findOne({ slug: slug.toLowerCase(), ...notDeleted }).lean<AstrologerDoc>();
    return d ? fromDoc(d) : null;
  },
  async findByEmail(email) {
    const m = await M();
    const d = await m.findOne({ email: email.toLowerCase(), ...notDeleted }).lean<AstrologerDoc>();
    return d ? fromDoc(d) : null;
  },
  async emailTaken(email, exceptId) {
    const m = await M();
    const q: Record<string, unknown> = { email: email.toLowerCase(), ...notDeleted };
    if (exceptId && isObjectId(exceptId)) q._id = { $ne: exceptId };
    return Boolean(await m.exists(q));
  },
  async slugTaken(slug, exceptId) {
    const m = await M();
    const q: Record<string, unknown> = { slug, ...notDeleted };
    if (exceptId && isObjectId(exceptId)) q._id = { $ne: exceptId };
    return Boolean(await m.exists(q));
  },
  async create(a, auth) {
    const m = await M();
    const created = await m.create({ ...toDoc(a), passwordHash: auth.passwordHash, tokenVersion: 0 });
    return fromDoc(created.toObject() as AstrologerDoc);
  },
  async update(id, patch) {
    if (!isObjectId(id)) return null;
    const m = await M();
    const d = await m.findOneAndUpdate({ _id: id, ...notDeleted }, { $set: toDoc(patch) }, { new: true, runValidators: true }).lean<AstrologerDoc>();
    return d ? fromDoc(d) : null;
  },
  async remove(id) {
    if (!isObjectId(id)) return false;
    const m = await M();
    const r = await m.findOneAndUpdate({ _id: id, ...notDeleted }, { $set: { isDeleted: true, deletedAt: new Date(), "presence.online": false } }).lean();
    return Boolean(r);
  },
  async getAuth(id) {
    if (!isObjectId(id)) return null;
    const m = await M();
    const d = await m.findOne({ _id: id, ...notDeleted })
      .select("+passwordHash +tokenVersion +refreshTokenHash +failedLoginCount +lockedUntil +passwordResetTokenHash +passwordResetExpires")
      .lean<Record<string, unknown>>();
    if (!d) return null;
    return {
      passwordHash: (d.passwordHash as string) ?? null,
      tokenVersion: (d.tokenVersion as number) ?? 0,
      refreshTokenHash: (d.refreshTokenHash as string) ?? null,
      failedLoginCount: (d.failedLoginCount as number) ?? 0,
      lockedUntil: (d.lockedUntil as Date) ?? null,
      passwordResetTokenHash: (d.passwordResetTokenHash as string) ?? null,
      passwordResetExpires: (d.passwordResetExpires as Date) ?? null,
    };
  },
  async setAuth(id, patch) {
    if (!isObjectId(id)) return;
    const m = await M();
    await m.updateOne({ _id: id }, { $set: patch });
  },
  async bumpTokenVersion(id) {
    if (!isObjectId(id)) return;
    const m = await M();
    await m.updateOne({ _id: id }, { $inc: { tokenVersion: 1 }, $set: { refreshTokenHash: null } });
  },
  async findIdByResetHash(hash) {
    const m = await M();
    const d = await m.findOne({ passwordResetTokenHash: hash, passwordResetExpires: { $gt: new Date() }, ...notDeleted }).select("_id").lean();
    return d ? String(d._id) : null;
  },
  async getFinancial(id) {
    if (!isObjectId(id)) return null;
    const m = await M();
    const d = await m.findOne({ _id: id }).select("+panNumber +payoutAccountNumber").lean<Record<string, unknown>>();
    return d ? { panNumber: (d.panNumber as string) ?? null, payoutAccountNumber: (d.payoutAccountNumber as string) ?? null } : null;
  },
  async setFinancial(id, patch) {
    if (!isObjectId(id)) return;
    const m = await M();
    await m.updateOne({ _id: id }, { $set: patch });
  },
};

export function getAstrologerRepository(): AstrologerRepository {
  return dataSourceFor("astrologers") === "mongo" ? mongoRepo : mockRepo;
}
