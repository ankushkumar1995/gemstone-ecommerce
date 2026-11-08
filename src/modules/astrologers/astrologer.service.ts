import "server-only";

/**
 * Astrologers domain — service (business rules).
 *
 * Key rules
 *  • Status changes follow TRANSITIONS; reasons are required for reject/suspend.
 *  • Approval needs the REQUIRED_KYC documents verified (program setting).
 *  • Going online needs: approved + not hidden + KYC complete (if required).
 *  • An online astrologer whose heartbeat is older than `presenceStaleSec` is
 *    treated as offline everywhere (computed on read, persisted lazily).
 *  • Approved astrologers' name/photo/bio edits are held in `pendingChanges`
 *    for admin review (program setting); everything else applies at once.
 *  • Rates must sit inside [minRate, effectiveMaxRate].
 *  • Suspend / deactivate / remove: kills all sessions (tokenVersion bump),
 *    sets offline and emits `astrologerBlocked` so live consultations end.
 *  • PAN is stored in full (needed for TDS) but only in a select:false field;
 *    Aadhaar is never stored in full, only masked. Bank account: same as PAN.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import { hashPassword, passwordIssue, generatePassword } from "@/core/password";
import { auditService } from "@/modules/audit";
import { astroSettingsService, type AstroProgramSettings } from "@/modules/astro-settings";
import { BRAND } from "@/lib/brand";
import { getAstrologerRepository } from "./astrologer.repository";
import { emitAstrologerBlocked } from "./astrologer.events";
import { mailApplicationReceived, mailInvite, mailKycReviewed, mailStatusChanged } from "./astrologer.emails";
import type {
  Astrologer, AstrologerActivity, AstrologerListFilter, AstrologerStatus, KycDoc, KycDocType,
  PublicAstrologer, PublicListFilter, SelfAstrologer,
} from "./astrologer.types";
import { REQUIRED_KYC } from "./astrologer.types";
import type { AdminUpdateDto, ApplyDto, InviteDto, KycSubmitDto, PayoutAccountDto, PresenceDto, SelfUpdateDto } from "./astrologer.schema";

export interface Actor { name: string; kind: "admin" | "self" | "system" }

const TRANSITIONS: Record<AstrologerStatus, AstrologerStatus[]> = {
  applied: ["under_review", "approved", "rejected"],
  under_review: ["approved", "rejected"],
  approved: ["suspended", "deactivated"],
  rejected: ["under_review"],
  suspended: ["approved", "deactivated"],
  deactivated: ["under_review", "approved"],
};
/** Transitions an astrologer may trigger on their own account. */
const SELF_TRANSITIONS: Partial<Record<AstrologerStatus, AstrologerStatus[]>> = {
  rejected: ["under_review"],
  approved: ["deactivated"],
  deactivated: ["under_review"],
};
const BLOCKING: AstrologerStatus[] = ["suspended", "deactivated"];
const REVIEWED_FIELDS = ["displayName", "photo", "shortBio", "bio"] as const;
const ACTIVITY_LIMIT = 80;

/* ---------------- helpers ---------------- */

function entry(type: AstrologerActivity["type"], message: string, actor: Actor | string = "System"): AstrologerActivity {
  return { id: newId("aact"), at: new Date().toISOString(), type, message, actor: typeof actor === "string" ? actor : actor.name };
}
const pushLog = (a: Astrologer, e: AstrologerActivity) => [e, ...a.activity].slice(0, ACTIVITY_LIMIT);

export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "astrologer";
}
async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const repo = getAstrologerRepository();
  const root = slugify(base);
  if (!(await repo.slugTaken(root, exceptId))) return root;
  for (let i = 2; i < 200; i++) {
    const s = `${root}-${i}`;
    if (!(await repo.slugTaken(s, exceptId))) return s;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export const maskPan = (p: string) => `XXXXX${p.slice(5, 9)}${p.slice(9)}`;
export const maskAadhaar = (n: string) => `XXXX XXXX ${n.replace(/\s/g, "").slice(-4)}`;
export const maskAccount = (n: string) => `${"X".repeat(Math.max(0, n.length - 4))}${n.slice(-4)}`;
const normPhone = (p: string) => p.replace(/[\s-]/g, "").replace(/^\+91/, "").slice(-10);

/** Is the stored presence fresh enough to count as online? */
export function isOnline(a: Astrologer, s: AstroProgramSettings, now = Date.now()): boolean {
  if (!a.presence.online || a.status !== "approved" || a.hidden) return false;
  const hb = a.presence.lastHeartbeatAt ? Date.parse(a.presence.lastHeartbeatAt) : 0;
  return now - hb <= s.presenceStaleSec * 1000;
}
export function kycComplete(a: Astrologer): boolean {
  return REQUIRED_KYC.every((t) => a.kyc.find((d) => d.type === t)?.status === "verified");
}
export const effectiveCommission = (a: Astrologer, s: AstroProgramSettings) => a.commissionPct ?? s.commissionPct;
export const effectiveMaxRate = (a: Astrologer, s: AstroProgramSettings) => Math.min(a.maxRate ?? s.maxRate, s.maxRate);

function rateIssue(rates: Partial<Astrologer["rates"]> | undefined, a: Astrologer | null, s: AstroProgramSettings): string | null {
  if (!rates) return null;
  const max = a ? effectiveMaxRate(a, s) : s.maxRate;
  for (const [ch, v] of Object.entries(rates)) {
    if (v === undefined) continue;
    if (v !== 0 && (v < s.minRate || v > max)) return `${ch} rate must be between ₹${s.minRate} and ₹${max} per minute (0 to switch it off)`;
  }
  return null;
}

export function toPublic(a: Astrologer, s: AstroProgramSettings): PublicAstrologer {
  const online = isOnline(a, s);
  return {
    id: a.id, slug: a.slug, displayName: a.displayName, gender: a.gender, photo: a.photo, shortBio: a.shortBio, bio: a.bio,
    languages: a.languages, expertise: a.expertise, categories: a.categories, experienceYears: a.experienceYears, education: a.education,
    rates: a.rates, availability: a.availability, timezone: a.timezone,
    online, busy: online && Boolean(a.presence.busyWith), channels: online ? a.presence.channels : { chat: false, call: false, video: false },
    rating: a.stats.rating, reviewCount: a.stats.reviewCount, totalSessions: a.stats.totalSessions, totalMinutes: a.stats.totalMinutes,
    verified: kycComplete(a), featured: a.featured, badges: a.badges,
  };
}

function toSelf(a: Astrologer, s: AstroProgramSettings): SelfAstrologer {
  const { adminNotes: _n, sortWeight: _w, hidden: _h, commissionPct: _c, maxRate: _m, ...rest } = a;
  void _n; void _w; void _h; void _c; void _m;
  // Admin notes on the timeline are internal: never send them to the partner.
  return { ...rest, activity: a.activity.filter((e) => e.type !== "note"), presence: { ...a.presence, online: isOnline(a, s) }, effectiveCommissionPct: effectiveCommission(a, s), effectiveMaxRate: effectiveMaxRate(a, s) };
}

/** Admin view: presence normalised to the computed value. */
const withLivePresence = (a: Astrologer, s: AstroProgramSettings): Astrologer => ({ ...a, presence: { ...a.presence, online: isOnline(a, s) } });

async function record(a: Astrologer, action: "create" | "update" | "status" | "delete", summary: string, actor?: Actor) {
  await auditService.record({ action, entity: "astrologer", entityId: a.id, entityLabel: a.displayName, summary, actor: actor?.kind === "admin" ? actor.name : undefined });
}

/* ---------------- service ---------------- */

export const astrologerService = {
  /** Public self-signup. Creates an `applied` account; the route logs the user in. */
  async apply(dto: ApplyDto): Promise<Result<Astrologer>> {
    const repo = getAstrologerRepository();
    const s = await astroSettingsService.get();
    const pw = passwordIssue(dto.password);
    if (pw) return fail(AppErrors.validation(pw));
    if (await repo.emailTaken(dto.email)) return fail(AppErrors.conflict("An account with this email already exists. Sign in instead."));
    const rates = { ...s.defaultRates, ...(dto.rates ?? {}) };
    const ri = rateIssue(rates, null, s);
    if (ri) return fail(AppErrors.validation(ri));

    const now = new Date().toISOString();
    const a: Astrologer = {
      id: newId("ast"),
      slug: await uniqueSlug(dto.displayName),
      displayName: dto.displayName, legalName: dto.legalName, email: dto.email, phone: normPhone(dto.phone),
      gender: dto.gender, city: dto.city, state: dto.state, photo: dto.photo || undefined,
      shortBio: dto.shortBio, bio: dto.bio, languages: dto.languages, expertise: dto.expertise, categories: dto.categories ?? [],
      experienceYears: dto.experienceYears, education: dto.education, certifications: dto.certifications,
      rates, availability: [], timezone: "Asia/Kolkata",
      status: "applied", appliedAt: now, statusChangedAt: now, source: "self",
      kyc: [], presence: { online: false, channels: { chat: true, call: rates.call > 0, video: rates.video > 0 } },
      stats: { rating: 0, reviewCount: 0, totalSessions: 0, totalMinutes: 0, missedRequests: 0, missedStreak: 0, repeatCustomers: 0 },
      commissionPct: null, maxRate: null, featured: false, sortWeight: 0, badges: [], hidden: false,
      mustChangePassword: false, activity: [entry("created", "Applied as a partner astrologer", "Astrologer")],
      createdAt: now, updatedAt: now,
    };
    const created = await repo.create(a, { passwordHash: await hashPassword(dto.password) });
    await record(created, "create", `New astrologer application: ${created.displayName}`);
    mailApplicationReceived(created.email, created.displayName);
    return ok(created);
  },

  /** Admin invite. Returns the one-time temporary password (also emailed). */
  async invite(dto: InviteDto, actor: Actor): Promise<Result<{ astrologer: Astrologer; tempPassword: string }>> {
    const repo = getAstrologerRepository();
    const s = await astroSettingsService.get();
    if (await repo.emailTaken(dto.email)) return fail(AppErrors.conflict("An astrologer with this email already exists"));
    const tempPassword = generatePassword(14);
    const now = new Date().toISOString();
    const status: AstrologerStatus = dto.approveNow ? "approved" : "under_review";
    const a: Astrologer = {
      id: newId("ast"), slug: await uniqueSlug(dto.displayName),
      displayName: dto.displayName, legalName: dto.legalName, email: dto.email, phone: normPhone(dto.phone),
      languages: dto.languages, expertise: dto.expertise, categories: [], experienceYears: dto.experienceYears,
      rates: { ...s.defaultRates }, availability: [], timezone: "Asia/Kolkata",
      status, statusChangedAt: now, appliedAt: now, source: "invite",
      approvedAt: dto.approveNow ? now : undefined, approvedBy: dto.approveNow ? actor.name : undefined,
      kyc: [], presence: { online: false, channels: { chat: true, call: false, video: false } },
      stats: { rating: 0, reviewCount: 0, totalSessions: 0, totalMinutes: 0, missedRequests: 0, missedStreak: 0, repeatCustomers: 0 },
      commissionPct: null, maxRate: null, featured: false, sortWeight: 0, badges: [], hidden: false,
      mustChangePassword: true, activity: [entry("created", `Invited by ${actor.name}${dto.approveNow ? " (pre-approved)" : ""}`, actor)],
      createdAt: now, updatedAt: now,
    };
    const created = await repo.create(a, { passwordHash: await hashPassword(tempPassword) });
    await record(created, "create", `Invited astrologer ${created.displayName}`, actor);
    mailInvite(created.email, created.displayName, tempPassword, `${BRAND.url}/astrologer/login`);
    return ok({ astrologer: created, tempPassword });
  },

  /* ---------- reads ---------- */

  async listAdmin(filter?: AstrologerListFilter): Promise<Result<Astrologer[]>> {
    const s = await astroSettingsService.get();
    const rows = await getAstrologerRepository().findAll(filter);
    return ok(rows.map((a) => withLivePresence(a, s)));
  },

  async getAdmin(id: string): Promise<Result<Astrologer & { effectiveCommissionPct: number; effectiveMaxRate: number; kycComplete: boolean }>> {
    const s = await astroSettingsService.get();
    const a = await getAstrologerRepository().findById(id);
    if (!a) return fail(AppErrors.notFound("Astrologer not found"));
    return ok({ ...withLivePresence(a, s), effectiveCommissionPct: effectiveCommission(a, s), effectiveMaxRate: effectiveMaxRate(a, s), kycComplete: kycComplete(a) });
  },

  async getSelf(id: string): Promise<Result<SelfAstrologer>> {
    const s = await astroSettingsService.get();
    const a = await getAstrologerRepository().findById(id);
    if (!a) return fail(AppErrors.notFound("Account not found"));
    return ok(toSelf(a, s));
  },

  /** Raw record for other server modules (consultations, payouts). */
  async getInternal(id: string): Promise<Astrologer | null> {
    return getAstrologerRepository().findById(id);
  },

  async counts(): Promise<Result<{ pendingReview: number; online: number; approved: number; pendingEdits: number; total: number }>> {
    const s = await astroSettingsService.get();
    const all = await getAstrologerRepository().findAll();
    return ok({
      pendingReview: all.filter((a) => a.status === "applied" || a.status === "under_review").length,
      online: all.filter((a) => isOnline(a, s)).length,
      approved: all.filter((a) => a.status === "approved").length,
      pendingEdits: all.filter((a) => a.pendingChanges).length,
      total: all.length,
    });
  },

  /** Storefront / app directory: approved + visible only, filtered, sorted, paged. */
  async listPublic(f: PublicListFilter = {}): Promise<Result<{ items: PublicAstrologer[]; total: number; page: number; pageSize: number; onlineCount: number }>> {
    const s = await astroSettingsService.get();
    const rows = (await getAstrologerRepository().findAll({ status: "approved" })).filter((a) => !a.hidden);
    let items = rows.map((a) => ({ a, p: toPublic(a, s) }));
    const q = f.q?.trim().toLowerCase();
    if (q) items = items.filter(({ p }) => [p.displayName, ...p.expertise, ...p.categories, ...p.languages].some((v) => v.toLowerCase().includes(q)));
    if (f.expertise) items = items.filter(({ p }) => p.expertise.includes(f.expertise!));
    if (f.category) items = items.filter(({ p }) => p.categories.includes(f.category!));
    if (f.language) items = items.filter(({ p }) => p.languages.includes(f.language!));
    if (f.gender) items = items.filter(({ p }) => p.gender === f.gender);
    if (f.online) items = items.filter(({ p }) => p.online);
    if (f.channel) items = items.filter(({ p }) => p.rates[f.channel!] > 0 && (!f.online || p.channels[f.channel!]));
    if (f.maxRate) items = items.filter(({ p }) => p.rates.chat <= f.maxRate!);

    const sorters: Record<NonNullable<PublicListFilter["sort"]>, (x: (typeof items)[number], y: (typeof items)[number]) => number> = {
      recommended: (x, y) =>
        Number(y.p.online) - Number(x.p.online) || Number(x.p.busy) - Number(y.p.busy) || Number(y.p.featured) - Number(x.p.featured) ||
        y.a.sortWeight - x.a.sortWeight || y.p.rating - x.p.rating || y.p.totalSessions - x.p.totalSessions,
      rating: (x, y) => y.p.rating - x.p.rating || y.p.reviewCount - x.p.reviewCount,
      experience: (x, y) => y.p.experienceYears - x.p.experienceYears,
      price_low: (x, y) => x.p.rates.chat - y.p.rates.chat,
      price_high: (x, y) => y.p.rates.chat - x.p.rates.chat,
      sessions: (x, y) => y.p.totalSessions - x.p.totalSessions,
    };
    items.sort(sorters[f.sort ?? "recommended"]);
    const pageSize = Math.min(Math.max(f.pageSize ?? 24, 1), 60);
    const page = Math.max(f.page ?? 1, 1);
    const onlineCount = items.filter(({ p }) => p.online).length;
    return ok({ items: items.slice((page - 1) * pageSize, page * pageSize).map(({ p }) => p), total: items.length, page, pageSize, onlineCount });
  },

  async getPublic(slug: string): Promise<Result<PublicAstrologer>> {
    const s = await astroSettingsService.get();
    const a = await getAstrologerRepository().findBySlug(slug);
    if (!a || a.status !== "approved" || a.hidden) return fail(AppErrors.notFound("Astrologer not found"));
    return ok(toPublic(a, s));
  },

  /* ---------- profile ---------- */

  async updateSelf(id: string, dto: SelfUpdateDto): Promise<Result<SelfAstrologer>> {
    const repo = getAstrologerRepository();
    const s = await astroSettingsService.get();
    const a = await repo.findById(id);
    if (!a) return fail(AppErrors.notFound("Account not found"));
    if (a.status === "suspended") return fail(AppErrors.forbidden("Your account is suspended. Contact support."));
    const ri = rateIssue(dto.rates, a, s);
    if (ri) return fail(AppErrors.validation(ri));

    const patch: Partial<Astrologer> = {};
    const held: Partial<Record<(typeof REVIEWED_FIELDS)[number], string>> = {};
    const reviewEdits = a.status === "approved" && s.reviewProfileEdits;
    for (const [k, v] of Object.entries(dto) as [keyof SelfUpdateDto, unknown][]) {
      if (v === undefined) continue;
      if (reviewEdits && (REVIEWED_FIELDS as readonly string[]).includes(k) && v !== a[k as keyof Astrologer]) {
        held[k as (typeof REVIEWED_FIELDS)[number]] = (v as string) || "";
        continue;
      }
      (patch as Record<string, unknown>)[k] = k === "phone" ? normPhone(v as string) : k === "photo" ? (v as string) || undefined : v;
    }
    if (patch.displayName && a.status !== "approved") patch.slug = await uniqueSlug(patch.displayName, a.id);
    if (patch.rates) {
      // Channels with a ₹0 rate cannot stay switched on.
      patch.presence = { ...a.presence, channels: { chat: a.presence.channels.chat && patch.rates.chat > 0, call: a.presence.channels.call && patch.rates.call > 0, video: a.presence.channels.video && patch.rates.video > 0 } };
    }
    const changes: string[] = Object.keys(patch).filter((k) => k !== "presence" && k !== "slug");
    if (Object.keys(held).length) {
      patch.pendingChanges = { ...(a.pendingChanges ?? {}), ...held, submittedAt: new Date().toISOString() };
    }
    if (!changes.length && !patch.pendingChanges) return ok(toSelf(a, s));
    patch.activity = pushLog(a, entry("profile", [
      changes.length ? `Updated ${changes.join(", ")}` : "",
      Object.keys(held).length ? `Sent ${Object.keys(held).join(", ")} for review` : "",
    ].filter(Boolean).join(". "), "Astrologer"));
    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Account not found"));
    return ok(toSelf(updated, s));
  },

  /** Admin approves/rejects held profile edits. */
  async reviewPending(id: string, approve: boolean, note: string | undefined, actor: Actor): Promise<Result<Astrologer>> {
    const repo = getAstrologerRepository();
    const a = await repo.findById(id);
    if (!a) return fail(AppErrors.notFound("Astrologer not found"));
    if (!a.pendingChanges) return fail(AppErrors.validation("There are no pending profile changes"));
    const { submittedAt: _s, ...changes } = a.pendingChanges;
    void _s;
    const patch: Partial<Astrologer> = { pendingChanges: undefined };
    if (approve) Object.assign(patch, Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v || undefined])));
    patch.activity = pushLog(a, entry("profile", `${approve ? "Approved" : "Rejected"} profile changes${note ? `: ${note}` : ""}`, actor));
    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Astrologer not found"));
    await record(updated, "update", `${approve ? "Approved" : "Rejected"} profile edits for ${updated.displayName}`, actor);
    return ok(updated);
  },

  async adminUpdate(id: string, dto: AdminUpdateDto, actor: Actor): Promise<Result<Astrologer>> {
    const repo = getAstrologerRepository();
    const s = await astroSettingsService.get();
    const a = await repo.findById(id);
    if (!a) return fail(AppErrors.notFound("Astrologer not found"));
    if (dto.email && dto.email !== a.email && (await repo.emailTaken(dto.email, id))) return fail(AppErrors.conflict("Another astrologer uses this email"));
    const probe = { ...a, maxRate: dto.maxRate !== undefined ? dto.maxRate : a.maxRate };
    const ri = rateIssue(dto.rates ?? a.rates, probe, s);
    if (ri) return fail(AppErrors.validation(ri));

    const { payoutVerified, ...rest } = dto;
    const patch: Partial<Astrologer> = { ...rest } as Partial<Astrologer>;
    if (rest.phone) patch.phone = normPhone(rest.phone);
    if (rest.photo !== undefined) patch.photo = rest.photo || undefined;
    if (rest.displayName && rest.displayName !== a.displayName) patch.slug = await uniqueSlug(rest.displayName, a.id);
    if (payoutVerified !== undefined) {
      if (!a.payout) return fail(AppErrors.validation("No payout account on file"));
      patch.payout = { ...a.payout, verified: payoutVerified };
    }
    const fields = Object.keys(dto);
    patch.activity = pushLog(a, entry("admin", `Admin updated ${fields.join(", ")}`, actor));
    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Astrologer not found"));
    await record(updated, "update", `Updated ${updated.displayName}: ${fields.join(", ")}`, actor);
    return ok(updated);
  },

  async addNote(id: string, note: string, actor: Actor): Promise<Result<Astrologer>> {
    const repo = getAstrologerRepository();
    const a = await repo.findById(id);
    if (!a) return fail(AppErrors.notFound("Astrologer not found"));
    const updated = await repo.update(id, { activity: pushLog(a, entry("note", note, actor)) });
    return updated ? ok(updated) : fail(AppErrors.notFound("Astrologer not found"));
  },

  /* ---------- status ---------- */

  async changeStatus(id: string, next: AstrologerStatus, reason: string | undefined, actor: Actor): Promise<Result<Astrologer>> {
    const repo = getAstrologerRepository();
    const s = await astroSettingsService.get();
    const a = await repo.findById(id);
    if (!a) return fail(AppErrors.notFound("Astrologer not found"));
    if (a.status === next) return ok(a);
    const allowed = actor.kind === "self" ? SELF_TRANSITIONS[a.status] ?? [] : TRANSITIONS[a.status];
    if (!allowed.includes(next)) return fail(AppErrors.validation(`Cannot change status from "${a.status}" to "${next}"`));
    if (next === "approved" && actor.kind !== "system" && s.requireKycForApproval && !kycComplete(a)) {
      const missing = REQUIRED_KYC.filter((t) => a.kyc.find((d) => d.type === t)?.status !== "verified");
      return fail(AppErrors.validation(`Verify these KYC documents first: ${missing.join(", ")}`));
    }
    if (next === "under_review" && actor.kind === "self") {
      const missing = REQUIRED_KYC.filter((t) => !a.kyc.find((d) => d.type === t && d.status !== "rejected"));
      if (missing.length) return fail(AppErrors.validation(`Upload these documents first: ${missing.join(", ")}`));
    }

    const now = new Date().toISOString();
    const patch: Partial<Astrologer> = {
      status: next, statusChangedAt: now, statusReason: reason || undefined,
      activity: pushLog(a, entry("status", `Status ${a.status} → ${next}${reason ? ` (${reason})` : ""}`, actor)),
    };
    if (next === "approved") { patch.approvedAt = now; patch.approvedBy = actor.name; }
    if (next !== "approved") patch.presence = { ...a.presence, online: false };
    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Astrologer not found"));
    if (next === "suspended") await repo.bumpTokenVersion(id);
    if (BLOCKING.includes(next)) await emitAstrologerBlocked(id, `Astrologer ${next}${reason ? `: ${reason}` : ""}`);
    await record(updated, "status", `${updated.displayName}: ${a.status} → ${next}`, actor);
    mailStatusChanged(updated.email, updated.displayName, next, reason);
    return ok(updated);
  },

  /* ---------- KYC ---------- */

  async submitKyc(id: string, dto: KycSubmitDto): Promise<Result<SelfAstrologer>> {
    const repo = getAstrologerRepository();
    const s = await astroSettingsService.get();
    const a = await repo.findById(id);
    if (!a) return fail(AppErrors.notFound("Account not found"));
    if (a.status === "suspended") return fail(AppErrors.forbidden("Your account is suspended. Contact support."));
    const type = dto.type as KycDocType;
    const existing = a.kyc.find((d) => d.type === type);
    if (existing?.status === "verified") return fail(AppErrors.validation("This document is already verified. Contact support to change it."));
    if (!dto.fileKey && type !== "pan" && type !== "aadhaar") return fail(AppErrors.validation("Upload the document file"));

    let numberMasked: string | undefined;
    if (type === "pan" && dto.number) {
      const pan = dto.number.toUpperCase();
      numberMasked = maskPan(pan);
      await repo.setFinancial(id, { panNumber: pan });
    }
    if (type === "aadhaar" && dto.number) numberMasked = maskAadhaar(dto.number);

    const doc: KycDoc = { type, fileKey: dto.fileKey ?? existing?.fileKey, fileName: dto.fileName ?? existing?.fileName, numberMasked: numberMasked ?? existing?.numberMasked, status: "pending", uploadedAt: new Date().toISOString() };
    const kyc = [...a.kyc.filter((d) => d.type !== type), doc];
    const patch: Partial<Astrologer> = { kyc, activity: pushLog(a, entry("kyc", `Submitted ${type.replace("_", " ")} for verification`, "Astrologer")) };
    // First full set of required documents moves a fresh application into review.
    const allRequired = REQUIRED_KYC.every((t) => kyc.some((d) => d.type === t && d.status !== "rejected"));
    if (a.status === "applied" && allRequired) {
      patch.status = "under_review";
      patch.statusChangedAt = new Date().toISOString();
      patch.activity = pushLog({ ...a, activity: patch.activity! }, entry("status", "Status applied → under_review (KYC submitted)", "System"));
    }
    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Account not found"));
    return ok(toSelf(updated, s));
  },

  async reviewKyc(id: string, type: KycDocType, status: "verified" | "rejected", note: string | undefined, actor: Actor): Promise<Result<Astrologer>> {
    const repo = getAstrologerRepository();
    const a = await repo.findById(id);
    if (!a) return fail(AppErrors.notFound("Astrologer not found"));
    const doc = a.kyc.find((d) => d.type === type);
    if (!doc) return fail(AppErrors.validation("This document was not submitted"));
    const kyc = a.kyc.map((d) => (d.type === type ? { ...d, status, note, reviewedAt: new Date().toISOString(), reviewedBy: actor.name } : d));
    const patch: Partial<Astrologer> = { kyc, activity: pushLog(a, entry("kyc", `${type.replace("_", " ")} ${status}${note ? `: ${note}` : ""}`, actor)) };
    // Verified bank proof also marks the payout account as verified.
    if (type === "bank_proof" && a.payout) patch.payout = { ...a.payout, verified: status === "verified" };
    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Astrologer not found"));
    await record(updated, "update", `KYC ${type} ${status} for ${updated.displayName}`, actor);
    mailKycReviewed(updated.email, updated.displayName, type.replace("_", " "), status, note);
    return ok(updated);
  },

  async setPayoutAccount(id: string, dto: PayoutAccountDto): Promise<Result<SelfAstrologer>> {
    const repo = getAstrologerRepository();
    const s = await astroSettingsService.get();
    const a = await repo.findById(id);
    if (!a) return fail(AppErrors.notFound("Account not found"));
    if (a.status === "suspended") return fail(AppErrors.forbidden("Your account is suspended. Contact support."));
    let payout: Astrologer["payout"];
    if (dto.method === "bank") {
      await repo.setFinancial(id, { payoutAccountNumber: dto.accountNumber });
      payout = { method: "bank", accountHolder: dto.accountHolder, accountNumberMasked: maskAccount(dto.accountNumber), ifsc: dto.ifsc, bankName: dto.bankName, verified: false };
    } else {
      await repo.setFinancial(id, { payoutAccountNumber: null });
      payout = { method: "upi", accountHolder: dto.accountHolder, upiId: dto.upiId, verified: false };
    }
    // Changing payout details always needs fresh verification (fraud guard).
    const kyc = a.kyc.map((d) => (d.type === "bank_proof" && d.status === "verified" ? { ...d, status: "pending" as const, note: "Payout details changed" } : d));
    const updated = await repo.update(id, { payout, kyc, activity: pushLog(a, entry("kyc", `Payout account set (${dto.method}), awaiting verification`, "Astrologer")) });
    if (!updated) return fail(AppErrors.notFound("Account not found"));
    return ok(toSelf(updated, s));
  },

  /** Admin-only: full payout destination for settlement. */
  async payoutDestination(id: string): Promise<Result<{ method: "bank" | "upi"; accountHolder?: string; accountNumber?: string; ifsc?: string; bankName?: string; upiId?: string; verified: boolean; pan?: string }>> {
    const repo = getAstrologerRepository();
    const a = await repo.findById(id);
    if (!a?.payout) return fail(AppErrors.notFound("No payout account on file"));
    const fin = await repo.getFinancial(id);
    return ok({ ...a.payout, accountNumber: fin?.payoutAccountNumber ?? undefined, pan: fin?.panNumber ?? undefined });
  },

  /* ---------- presence ---------- */

  async presence(id: string, dto: PresenceDto): Promise<Result<SelfAstrologer>> {
    const repo = getAstrologerRepository();
    const s = await astroSettingsService.get();
    const a = await repo.findById(id);
    if (!a) return fail(AppErrors.notFound("Account not found"));
    const now = new Date().toISOString();
    const channels = { ...a.presence.channels, ...(dto.channels ?? {}) };
    // A channel with a ₹0 rate can never be on.
    (Object.keys(channels) as (keyof typeof channels)[]).forEach((c) => { if (a.rates[c] <= 0) channels[c] = false; });

    if (dto.action === "online") {
      if (a.status !== "approved") return fail(AppErrors.forbidden("Your profile must be approved before you can go online"));
      if (a.hidden) return fail(AppErrors.forbidden("Your profile is hidden by the admin. Contact support."));
      if (s.requireKycForApproval && !kycComplete(a)) return fail(AppErrors.forbidden("Complete KYC verification before going online"));
      if (!channels.chat && !channels.call && !channels.video) return fail(AppErrors.validation("Turn on at least one of chat, call or video"));
      const wasOnline = isOnline(a, s);
      const updated = await repo.update(id, {
        presence: { ...a.presence, online: true, channels, lastHeartbeatAt: now, onlineSince: wasOnline ? a.presence.onlineSince : now },
        stats: { ...a.stats, missedStreak: 0 },
        activity: wasOnline ? a.activity : pushLog(a, entry("presence", "Went online", "Astrologer")),
      });
      return updated ? ok(toSelf(updated, s)) : fail(AppErrors.notFound("Account not found"));
    }
    if (dto.action === "heartbeat") {
      if (!a.presence.online || a.status !== "approved") return ok(toSelf(a, s));
      // A heartbeat after the stale window is a fresh "online" (the UI was asleep).
      const updated = await repo.update(id, { presence: { ...a.presence, channels, lastHeartbeatAt: now } });
      return updated ? ok(toSelf(updated, s)) : fail(AppErrors.notFound("Account not found"));
    }
    const updated = await repo.update(id, {
      presence: { ...a.presence, online: false, channels },
      activity: a.presence.online ? pushLog(a, entry("presence", "Went offline", "Astrologer")) : a.activity,
    });
    return updated ? ok(toSelf(updated, s)) : fail(AppErrors.notFound("Account not found"));
  },

  async forceOffline(id: string, reason: string, actor: Actor): Promise<Result<Astrologer>> {
    const repo = getAstrologerRepository();
    const a = await repo.findById(id);
    if (!a) return fail(AppErrors.notFound("Astrologer not found"));
    const updated = await repo.update(id, { presence: { ...a.presence, online: false }, activity: pushLog(a, entry("presence", `Set offline: ${reason}`, actor)) });
    if (!updated) return fail(AppErrors.notFound("Astrologer not found"));
    if (actor.kind === "admin") await record(updated, "update", `Forced ${updated.displayName} offline: ${reason}`, actor);
    return ok(updated);
  },

  /** Called by consultations when a request times out. Auto-offline after N misses. */
  async recordMissed(id: string): Promise<void> {
    const repo = getAstrologerRepository();
    const s = await astroSettingsService.get();
    const a = await repo.findById(id);
    if (!a) return;
    const streak = a.stats.missedStreak + 1;
    const goOffline = streak >= s.maxMissedBeforeOffline;
    await repo.update(id, {
      stats: { ...a.stats, missedRequests: a.stats.missedRequests + 1, missedStreak: goOffline ? 0 : streak },
      presence: goOffline ? { ...a.presence, online: false } : a.presence,
      activity: goOffline ? pushLog(a, entry("presence", `Set offline after ${streak} missed requests`, "System")) : a.activity,
    });
  },

  /** Busy flag maintained by consultations (one live session at a time). */
  async setBusy(id: string, sessionId: string | null): Promise<void> {
    const repo = getAstrologerRepository();
    const a = await repo.findById(id);
    if (!a) return;
    await repo.update(id, { presence: { ...a.presence, busyWith: sessionId ?? undefined } });
  },

  /** Stats roll-up after a completed session / review (consultations module). */
  async bumpStats(id: string, delta: Partial<{ sessions: number; minutes: number; repeat: number }>): Promise<void> {
    const repo = getAstrologerRepository();
    const a = await repo.findById(id);
    if (!a) return;
    await repo.update(id, { stats: { ...a.stats, totalSessions: a.stats.totalSessions + (delta.sessions ?? 0), totalMinutes: a.stats.totalMinutes + (delta.minutes ?? 0), repeatCustomers: a.stats.repeatCustomers + (delta.repeat ?? 0), missedStreak: 0 } });
  },

  async setRating(id: string, rating: number, reviewCount: number): Promise<void> {
    const repo = getAstrologerRepository();
    const a = await repo.findById(id);
    if (!a) return;
    await repo.update(id, { stats: { ...a.stats, rating: Math.round(rating * 10) / 10, reviewCount } });
  },

  async remove(id: string, actor: Actor): Promise<Result<{ id: string }>> {
    const repo = getAstrologerRepository();
    const a = await repo.findById(id);
    if (!a) return fail(AppErrors.notFound("Astrologer not found"));
    if (a.presence.busyWith) return fail(AppErrors.conflict("This astrologer is in a live session. End it first."));
    await repo.bumpTokenVersion(id);
    await repo.remove(id);
    await emitAstrologerBlocked(id, "Astrologer removed");
    await record(a, "delete", `Removed astrologer ${a.displayName}`, actor);
    return ok({ id });
  },
};
