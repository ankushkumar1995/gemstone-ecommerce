/**
 * Admin client for the astrologer platform (astrologers, program settings,
 * and later consultations / wallets / payouts). Same envelope + transparent
 * admin token refresh as `admin-api.ts`, kept separate so that file stays small.
 */

import type { ApiResponse } from "@/core/http";
import type { Astrologer, AstrologerStatus, KycDocType } from "@/modules/astrologers/astrologer.types";
import type { AstroProgramSettings } from "@/modules/astro-settings/astro-settings";
import type { WalletRecharge, WalletTxn, WalletTxnType } from "@/modules/wallets/wallet.types";
import type { RechargeStatusView, WalletView } from "@/modules/wallets/wallet.service";
import type { AdminRecharge, AdminTxn, WalletStats } from "@/modules/wallets/wallet.admin";
import type { AnnouncementWithStats } from "@/modules/partner-notices/notice.types";
import type { ConsultMessage, ConsultSession } from "@/modules/consultations/consult.types";
import type { LiveEvent, LiveQueueItem, LiveSession } from "@/modules/live/live.types";
import type { EarningsBalance, LedgerEntry, Payout } from "@/modules/earnings/earnings.types";
import type { RemedyRules, RemedySale, RemedyStats } from "@/modules/remedies/remedy.types";
import type {
  AgreementAcceptance, AgreementExtension, AgreementGateInfo, AgreementListItem, AgreementVersion, SignatureRow, SignedCopy,
} from "@/modules/agreements/agreement.types";

export type AdminRes<T> = { ok: true; data: T } | { ok: false; message: string; details?: unknown };

async function request<T>(url: string, init?: RequestInit, retried = false): Promise<AdminRes<T>> {
  try {
    // FormData (uploads) sets its own multipart Content-Type.
    const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
    const res = await fetch(url, { ...init, headers: isForm ? init?.headers : { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    if (res.status === 401 && !retried) {
      const r = await fetch("/api/v1/admin/refresh", { method: "POST" });
      if (r.ok) return request<T>(url, init, true);
    }
    const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
    if (body?.success) return { ok: true, data: body.data };
    return { ok: false, message: body && !body.success ? body.error.message : "Something went wrong", details: body && !body.success ? body.error.details : undefined };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}
const json = (method: string, data?: unknown): RequestInit => ({ method, body: data === undefined ? undefined : JSON.stringify(data) });
/** Query string from the non-empty fields. */
const qs = (f: Record<string, string | undefined>) => new URLSearchParams(Object.entries(f).filter((e): e is [string, string] => !!e[1])).toString();

export type AdminAstrologer = Astrologer & { effectiveCommissionPct: number; effectiveMaxRate: number; kycComplete: boolean };

export const astroAdminApi = {
  consultations: {
    list: (status: "live" | "reported" | "reviews" | "all") => request<{ sessions: ConsultSession[] }>(`/api/v1/admin/consultations?status=${status}`),
    get: (id: string) => request<{ session: ConsultSession; messages: ConsultMessage[] }>(`/api/v1/admin/consultations/${encodeURIComponent(id)}`),
    end: (id: string) => request<{ session: ConsultSession }>(`/api/v1/admin/consultations/${encodeURIComponent(id)}`, json("POST", { action: "end" })),
    refund: (id: string, amountPaise: number, reason: string, requestId: string) =>
      request<{ session: ConsultSession }>(`/api/v1/admin/consultations/${encodeURIComponent(id)}`, json("POST", { action: "refund", amountPaise, reason, requestId })),
    review: (id: string, approve: boolean) => request<{ session: ConsultSession }>(`/api/v1/admin/consultations/${encodeURIComponent(id)}`, json("POST", { action: "review", approve })),
  },
  payouts: {
    list: (status: string) => request<{ payouts: Payout[]; provider: { mode: "manual" | "razorpayx"; razorpayxReady: boolean; autoCreate: boolean; cycleWeekday: number } }>(`/api/v1/admin/payouts?status=${encodeURIComponent(status)}`),
    get: (id: string) => request<{ payout: Payout; destination: { method: "bank" | "upi"; accountHolder?: string; accountNumber?: string; ifsc?: string; bankName?: string; upiId?: string; verified: boolean; pan?: string } | null; balance: EarningsBalance }>(`/api/v1/admin/payouts/${encodeURIComponent(id)}`),
    act: (id: string, action: "approve" | "reject" | "mark_paid" | "mark_failed" | "send" | "refresh", extra: { utr?: string; reason?: string } = {}) =>
      request<{ payout: Payout }>(`/api/v1/admin/payouts/${encodeURIComponent(id)}`, json("POST", { action, ...extra })),
    exportUrl: (status: string) => `/api/v1/admin/payouts/export?status=${encodeURIComponent(status)}`,
  },
  earnings: {
    balances: () => request<{ balances: { astrologerId: string; name: string; balance: EarningsBalance }[] }>("/api/v1/admin/earnings"),
    of: (astrologerId: string, cursor?: string) => request<{ balance: EarningsBalance; entries: LedgerEntry[]; nextCursor: string | null; payouts: Payout[]; tds: { fy: string; payouts: number; grossPaise: number; tdsPaise: number }[] }>(`/api/v1/admin/earnings?astrologerId=${encodeURIComponent(astrologerId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`),
    adjust: (astrologerId: string, amountPaise: number, reason: string, requestId: string) => request<{ balance: EarningsBalance }>("/api/v1/admin/earnings", json("POST", { action: "adjust", astrologerId, amountPaise, reason, requestId })),
    reconcile: () => request<{ consultations: number; refunds: number; gifts: number; tips: number; superChats: number }>("/api/v1/admin/earnings", json("POST", { action: "reconcile" })),
    runWeekly: () => request<{ ran: boolean; created: number; skipped: number; date: string }>("/api/v1/admin/earnings", json("POST", { action: "run_weekly" })),
  },
  remedySales: {
    list: (f: { status?: string; astrologerId?: string; before?: string } = {}) => {
      const p = new URLSearchParams();
      if (f.status) p.set("status", f.status);
      if (f.astrologerId) p.set("astrologerId", f.astrologerId);
      if (f.before) p.set("before", f.before);
      return request<{ rules: RemedyRules; stats: RemedyStats; items: RemedySale[]; nextBefore: string | null }>(`/api/v1/admin/remedy-sales?${p.toString()}`);
    },
    reverse: (id: string, reason: string) => request<{ sale: RemedySale }>(`/api/v1/admin/remedy-sales/${encodeURIComponent(id)}`, json("POST", { reason })),
  },
  referrals: {
    list: (f: { status?: string; q?: string; before?: string } = {}) => {
      const p = new URLSearchParams();
      if (f.status) p.set("status", f.status);
      if (f.q) p.set("q", f.q);
      if (f.before) p.set("before", f.before);
      return request<{ items: AdminReferral[]; stats: Record<string, number>; nextBefore: string | null }>(`/api/v1/admin/referrals?${p.toString()}`);
    },
    decide: (id: string, decision: "approve" | "reject", note: string) => request<{ status: string }>(`/api/v1/admin/referrals/${encodeURIComponent(id)}`, json("POST", { decision, note })),
  },
  live: {
    list: (status: "live" | "scheduled" | "all") => request<{ lives: LiveSession[] }>(`/api/v1/admin/live?status=${status}`),
    get: (id: string) => request<{ live: LiveSession; viewers: number; events: (LiveEvent & { hidden: boolean; filtered?: boolean })[]; queue: LiveQueueItem[] }>(`/api/v1/admin/live/${encodeURIComponent(id)}`),
    end: (id: string) => request<{ live: LiveSession }>(`/api/v1/admin/live/${encodeURIComponent(id)}`, json("POST", { action: "end" })),
    hide: (id: string, seq: number) => request<{ live: LiveSession }>(`/api/v1/admin/live/${encodeURIComponent(id)}`, json("POST", { action: "hide", seq })),
    feature: (id: string, on: boolean) => request<{ live: LiveSession }>(`/api/v1/admin/live/${encodeURIComponent(id)}`, json("POST", { action: "feature", on })),
  },
  astrologers: {
    list: (status?: AstrologerStatus[], q?: string) => {
      const p = new URLSearchParams();
      if (status?.length) p.set("status", status.join(","));
      if (q) p.set("q", q);
      return request<Astrologer[]>(`/api/v1/admin/astrologers?${p.toString()}`);
    },
    counts: () => request<{ pendingReview: number; online: number; approved: number; pendingEdits: number; total: number }>("/api/v1/admin/astrologers/counts"),
    get: (id: string) => request<AdminAstrologer>(`/api/v1/admin/astrologers/${id}`),
    invite: (data: unknown) => request<{ astrologer: Astrologer; tempPassword: string }>("/api/v1/admin/astrologers", json("POST", data)),
    update: (id: string, data: unknown) => request<Astrologer>(`/api/v1/admin/astrologers/${id}`, json("PATCH", data)),
    remove: (id: string) => request<{ id: string }>(`/api/v1/admin/astrologers/${id}`, json("DELETE")),
    setStatus: (id: string, status: AstrologerStatus, reason?: string) => request<Astrologer>(`/api/v1/admin/astrologers/${id}/status`, json("PATCH", { status, reason })),
    reviewKyc: (id: string, type: KycDocType, status: "verified" | "rejected", note?: string) => request<Astrologer>(`/api/v1/admin/astrologers/${id}/kyc`, json("PATCH", { type, status, note })),
    kycFile: (id: string, type: KycDocType) => request<{ url: string; expiresIn: number }>(`/api/v1/admin/astrologers/${id}/kyc-file?type=${type}`),
    reviewPending: (id: string, approve: boolean, note?: string) => request<Astrologer>(`/api/v1/admin/astrologers/${id}/pending`, json("POST", { approve, note })),
    forceOffline: (id: string, note: string) => request<Astrologer>(`/api/v1/admin/astrologers/${id}/offline`, json("POST", { note })),
    addNote: (id: string, note: string) => request<Astrologer>(`/api/v1/admin/astrologers/${id}/notes`, json("POST", { note })),
    payoutDestination: (id: string) => request<{ method: "bank" | "upi"; accountHolder?: string; accountNumber?: string; ifsc?: string; bankName?: string; upiId?: string; verified: boolean; pan?: string }>(`/api/v1/admin/astrologers/${id}/payout-destination`),
  },
  wallets: {
    get: (customerId: string) =>
      request<{ wallet: WalletView; txns: WalletTxn[]; nextCursor: string | null; recharges: WalletRecharge[] }>(`/api/v1/admin/wallets/${customerId}`),
    txns: (customerId: string, cursor?: string, type?: WalletTxnType) => {
      const p = new URLSearchParams();
      if (cursor) p.set("cursor", cursor);
      if (type) p.set("type", type);
      return request<{ items: WalletTxn[]; nextCursor: string | null }>(`/api/v1/admin/wallets/${customerId}/txns?${p.toString()}`);
    },
    adjust: (customerId: string, data: { bucket: "cash" | "promo"; direction: "credit" | "debit"; amount: number; reason: string; requestId: string }) =>
      request<{ txn: WalletTxn; balance: { cashPaise: number; promoPaise: number } }>(`/api/v1/admin/wallets/${customerId}/adjust`, json("POST", data)),
    /* ---- all customers ---- */
    summary: () => request<WalletStats>("/api/v1/admin/wallets/summary"),
    allRecharges: (f: { status?: string; q?: string; from?: string; to?: string; cursor?: string }) =>
      request<{ items: AdminRecharge[]; nextCursor: string | null }>(`/api/v1/admin/wallets/recharges?${qs(f)}`),
    allTxns: (f: { type?: string; q?: string; from?: string; to?: string; cursor?: string }) =>
      request<{ items: AdminTxn[]; nextCursor: string | null }>(`/api/v1/admin/wallets/transactions?${qs(f)}`),
    reconcile: (orderId: string) => request<RechargeStatusView>(`/api/v1/admin/wallets/recharges/${encodeURIComponent(orderId)}/reconcile`, json("POST")),
  },
  announcements: {
    list: () => request<AnnouncementWithStats[]>("/api/v1/admin/partner-announcements"),
    publish: (data: { title: string; body: string; audience: "all" | "approved"; pinned: boolean }) => request<AnnouncementWithStats>("/api/v1/admin/partner-announcements", json("POST", data)),
    archive: (id: string) => request<unknown>(`/api/v1/admin/partner-announcements/${id}/archive`, json("POST", {})),
  },
  agreements: {
    list: () => request<AgreementListItem[]>("/api/v1/admin/agreements"),
    get: (id: string) => request<AgreementVersion>(`/api/v1/admin/agreements/${id}`),
    create: (data: unknown) => request<AgreementVersion>("/api/v1/admin/agreements", json("POST", data)),
    clone: (cloneFrom: string, version?: string) => request<AgreementVersion>("/api/v1/admin/agreements", json("POST", { cloneFrom, ...(version ? { version } : {}) })),
    update: (id: string, data: unknown) => request<AgreementVersion>(`/api/v1/admin/agreements/${id}`, json("PATCH", data)),
    remove: (id: string) => request<{ id: string }>(`/api/v1/admin/agreements/${id}`, json("DELETE")),
    publish: (id: string, confirmVersion: string) => request<AgreementVersion>(`/api/v1/admin/agreements/${id}/publish`, json("POST", { confirmVersion })),
    signatures: (id: string) => request<{ agreement: AgreementVersion; rows: SignatureRow[] }>(`/api/v1/admin/agreements/${id}/signatures`),
    remind: (id: string, astrologerIds?: string[]) => request<{ sent: number }>(`/api/v1/admin/agreements/${id}/remind`, json("POST", astrologerIds ? { astrologerIds } : {})),
    extend: (id: string, data: { astrologerId: string; until: string; reason: string }) => request<AgreementExtension>(`/api/v1/admin/agreements/${id}/extensions`, json("POST", data)),
    removeExtension: (id: string, astrologerId: string) => request<{ removed: boolean }>(`/api/v1/admin/agreements/${id}/extensions?astrologerId=${encodeURIComponent(astrologerId)}`, json("DELETE")),
    copy: (acceptanceId: string) => request<SignedCopy<AgreementAcceptance>>(`/api/v1/admin/agreement-acceptances/${acceptanceId}`),
    emailCopy: (acceptanceId: string) => request<{ sentTo: string }>(`/api/v1/admin/agreement-acceptances/${acceptanceId}/email`, json("POST", {})),
    voidSignature: (acceptanceId: string, reason: string) => request<AgreementAcceptance>(`/api/v1/admin/agreement-acceptances/${acceptanceId}/void`, json("POST", { reason })),
    forAstrologer: (astrologerId: string) => request<{ acceptances: AgreementAcceptance[]; gate: AgreementGateInfo; signupConsent: { version: string; at: string; ip: string; device: string } | null }>(`/api/v1/admin/astrologers/${astrologerId}/agreements`),
  },
  settings: {
    get: () => request<AstroProgramSettings>("/api/v1/admin/astro-settings"),
    update: (data: Partial<AstroProgramSettings>) => request<AstroProgramSettings>("/api/v1/admin/astro-settings", json("PATCH", data)),
  },
  request,
};

export interface AdminReferral {
  id: string; code: string; referrerId: string; refereeId: string; referrerName: string; refereeName: string;
  status: "pending" | "qualified" | "review" | "rewarded" | "expired" | "rejected";
  flags: string[]; appliedAt: string; expiresAt: string; qualifiedAt: string | null; rewardedAt: string | null;
  rechargePaise: number; referrerRewardPaise: number; refereeRewardPaise: number; referrerCapped: boolean; reviewNote: string; reviewedBy: string;
}

/* ---------------- Mantras & Aarti (devotional) ---------------- */
export type { DevotionalItem, DevotionalKind } from "@/modules/devotional/devotional.types";
type DevoItem = import("@/modules/devotional/devotional.types").DevotionalItem;
export const devotionalAdminApi = {
  list: (f: { kind?: string; status?: string; q?: string } = {}) => {
    const p = new URLSearchParams();
    if (f.kind) p.set("kind", f.kind);
    if (f.status) p.set("status", f.status);
    if (f.q) p.set("q", f.q);
    return request<{ items: DevoItem[]; counts: Record<string, number> }>(`/api/v1/admin/devotional?${p.toString()}`);
  },
  get: (id: string) => request<{ item: DevoItem }>(`/api/v1/admin/devotional/${encodeURIComponent(id)}`),
  create: (data: unknown) => request<{ item: DevoItem }>("/api/v1/admin/devotional", json("POST", data)),
  update: (id: string, data: unknown) => request<{ item: DevoItem }>(`/api/v1/admin/devotional/${encodeURIComponent(id)}`, json("PATCH", data)),
  remove: (id: string) => request<{ ok: true }>(`/api/v1/admin/devotional/${encodeURIComponent(id)}`, json("DELETE")),
  reorder: (ids: string[]) => request<{ ok: true }>("/api/v1/admin/devotional", json("PUT", { action: "reorder", ids })),
  importMany: (items: unknown, dryRun: boolean) => request<{ created: number; updated: number; failed: { row: number; slug: string; error: string }[] }>("/api/v1/admin/devotional", json("PUT", { action: "import", items, dryRun })),
  upload: async (file: File, type: "audio" | "image") => {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("type", type);
    return request<{ url: string; key: string; bytes: number; contentType: string }>("/api/v1/admin/devotional/upload", { method: "POST", body: fd });
  },
};
export type { RemedyRules, RemedySale, RemedyStats };
