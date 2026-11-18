/**
 * Partner (astrologer) panel API client. Transparently refreshes the 15-minute
 * access token once on a 401, then retries; concurrent 401s share one refresh.
 * Type-only imports from server modules keep this safe for client bundles.
 */

import type { ApiResponse } from "@/core/http";
import type { SelfAstrologer, PublicAstrologer, PublicListFilter } from "@/modules/astrologers/astrologer.types";
import type { AstroIdentity } from "@/modules/astrologer-auth/astrologer-auth.service";
import type { OtpSendResult, PartnerAcceptanceView, PartnerAgreementState, SignedCopy } from "@/modules/agreements/agreement.types";
import type { Announcement, PartnerNotification } from "@/modules/partner-notices/notice.types";
import type { SessionView } from "@/modules/consultations/consult.service";
import type { ConsultMessage } from "@/modules/consultations/consult.types";

import type { LiveView } from "@/modules/live/live.service";
import type { EarningsBalance, LedgerEntry, Payout } from "@/modules/earnings/earnings.types";
import type { WaitEntryView } from "@/modules/consultations/consult.waitlist";
import type { LiveEvent, LiveQueueItem } from "@/modules/live/live.types";

export type { SessionView, ConsultMessage };

export type Res<T> = { ok: true; data: T } | { ok: false; message: string; status: number; details?: unknown };

let refreshing: Promise<boolean> | null = null;
function refreshOnce(): Promise<boolean> {
  refreshing ??= fetch("/api/v1/astrologer-auth/refresh", { method: "POST" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => { setTimeout(() => { refreshing = null; }, 0); });
  return refreshing;
}

async function request<T>(url: string, init?: RequestInit, retried = false): Promise<Res<T>> {
  try {
    const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
    const res = await fetch(url, { ...init, headers: isForm ? init?.headers : { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    if (res.status === 401 && !retried && !url.includes("/astrologer-auth/")) {
      if (await refreshOnce()) return request<T>(url, init, true);
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/astrologer/login")) {
        window.location.href = `/astrologer/login?from=${encodeURIComponent(window.location.pathname)}`;
      }
    }
    const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
    if (body?.success) return { ok: true, data: body.data };
    return { ok: false, status: res.status, message: body && !body.success ? body.error.message : "Something went wrong", details: body && !body.success ? body.error.details : undefined };
  } catch {
    return { ok: false, status: 0, message: "Network error. Check your connection." };
  }
}

const json = (method: string, data?: unknown): RequestInit => ({ method, body: data === undefined ? undefined : JSON.stringify(data) });

export const partnerApi = {
  auth: {
    apply: (data: unknown) => request<{ id: string; status: string }>("/api/v1/astrologer-auth/apply", json("POST", data)),
    login: (email: string, password: string) => request<{ astrologer: AstroIdentity }>("/api/v1/astrologer-auth/login", json("POST", { email, password })),
    logout: (all = false) => request<{ ok: true }>(`/api/v1/astrologer-auth/logout${all ? "?all=1" : ""}`, json("POST")),
    changePassword: (currentPassword: string, newPassword: string) => request<{ ok: true }>("/api/v1/astrologer-auth/change-password", json("POST", { currentPassword, newPassword })),
    forgot: (email: string) => request<{ sent: true; devToken?: string }>("/api/v1/astrologer-auth/forgot-password", json("POST", { email })),
    reset: (token: string, newPassword: string) => request<{ id: string }>("/api/v1/astrologer-auth/reset-password", json("POST", { token, newPassword })),
  },
  me: () => request<SelfAstrologer>("/api/v1/astrologer/me"),
  updateProfile: (data: unknown) => request<SelfAstrologer>("/api/v1/astrologer/profile", json("PATCH", data)),
  presence: (action: "online" | "offline" | "heartbeat", channels?: Partial<Record<"chat" | "call" | "video", boolean>>) =>
    request<SelfAstrologer>("/api/v1/astrologer/presence", json("POST", { action, channels })),
  setStatus: (status: "under_review" | "deactivated", reason?: string) => request<SelfAstrologer>("/api/v1/astrologer/status", json("POST", { status, reason })),
  submitKyc: (data: { type: string; number?: string; fileKey?: string; fileName?: string }) => request<SelfAstrologer>("/api/v1/astrologer/kyc", json("POST", data)),
  uploadKyc: (type: string, file: File) => {
    const fd = new FormData();
    fd.set("type", type);
    fd.set("file", file);
    return request<{ fileKey: string; fileName: string }>("/api/v1/astrologer/kyc/upload", { method: "POST", body: fd });
  },
  uploadPhoto: (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    return request<{ url: string }>("/api/v1/astrologer/photo", { method: "POST", body: fd });
  },
  setPayoutAccount: (data: unknown) => request<SelfAstrologer>("/api/v1/astrologer/payout-account", json("PUT", data)),
  notices: {
    list: (before?: string, unreadOnly = false) => {
      const p = new URLSearchParams();
      if (before) p.set("before", before);
      if (unreadOnly) p.set("unread", "1");
      return request<{ items: PartnerNotification[]; unread: number; nextBefore: string | null }>(`/api/v1/astrologer/notifications?${p.toString()}`);
    },
    count: () => request<{ unread: number }>("/api/v1/astrologer/notifications/count"),
    markRead: (ids: string[] | "all") => request<{ updated: number; unread: number }>("/api/v1/astrologer/notifications", json("POST", ids === "all" ? { all: true } : { ids })),
    announcements: () => request<Announcement[]>("/api/v1/astrologer/announcements"),
  },
  agreement: {
    state: () => request<PartnerAgreementState>("/api/v1/astrologer/agreement"),
    sendOtp: (data: SignInput) => request<OtpSendResult>("/api/v1/astrologer/agreement/otp", json("POST", data)),
    sign: (data: SignInput & { challengeId: string; code: string; secondsOnPage: number }) =>
      request<PartnerAcceptanceView>("/api/v1/astrologer/agreement/sign", json("POST", data)),
    copy: (id: string) => request<SignedCopy>(`/api/v1/astrologer/agreement/acceptances/${encodeURIComponent(id)}`),
  },
  consult: {
    /** Long-poll: answers at once when `sig` differs, else after ~20 s. */
    inbox: (sig: string, wait: boolean, signal?: AbortSignal) =>
      request<ConsultInbox>(`/api/v1/astrologer/consult/inbox?sig=${encodeURIComponent(sig)}${wait ? "&wait=1" : ""}`, { signal }),
    history: () => request<{ sessions: SessionView[] }>("/api/v1/astrologer/consult/history"),
    events: (id: string, after: number, v: number, wait: boolean, signal?: AbortSignal) =>
      request<{ session: SessionView; messages: ConsultMessage[] }>(`/api/v1/consult/sessions/${encodeURIComponent(id)}?after=${after}&v=${v}${wait ? "&wait=1" : ""}`, { signal }),
    act: <T = { session: SessionView }>(id: string, action: "accept" | "decline" | "end" | "typing" | "read" | "messages" | "report" | "block", body?: unknown) =>
      request<T>(`/api/v1/consult/sessions/${encodeURIComponent(id)}/${action}`, json("POST", body ?? {})),
  },
  earnings: {
    get: (cursor?: string, type?: string) => {
      const p = new URLSearchParams();
      if (cursor) p.set("cursor", cursor);
      if (type) p.set("type", type);
      return request<{ balance: EarningsBalance; entries: LedgerEntry[]; nextCursor: string | null; rules: EarningsRules; tds: TdsYear[] }>(`/api/v1/astrologer/earnings?${p.toString()}`);
    },
    payouts: () => request<{ payouts: Payout[]; balance: EarningsBalance; rules: EarningsRules }>("/api/v1/astrologer/payouts"),
    requestPayout: (requestId: string, amountPaise?: number) => request<{ payout: Payout }>("/api/v1/astrologer/payouts", json("POST", { requestId, amountPaise })),
    cancelPayout: (id: string) => request<{ payout: Payout }>(`/api/v1/astrologer/payouts/${encodeURIComponent(id)}/cancel`, json("POST")),
  },
  waitlist: {
    get: () => request<WaitlistState>("/api/v1/astrologer/consult/waitlist"),
    act: (body: { action: "open" | "close" } | { action: "remove"; id: string }) => request<WaitlistState>("/api/v1/astrologer/consult/waitlist", json("POST", body)),
  },
  live: {
    mine: () => request<{ current: LiveView | null; scheduled: LiveView[]; past: LiveView[] }>("/api/v1/astrologer/live"),
    create: (data: { title: string; topic?: string; tags?: string[]; scheduledAt?: string | null }) => request<{ live: LiveView }>("/api/v1/astrologer/live", json("POST", data)),
    events: (id: string, after: number, v: number, wait: boolean, signal?: AbortSignal) =>
      request<{ live: LiveView; events: LiveEvent[]; queue: LiveQueueItem[] | null }>(`/api/v1/live/${encodeURIComponent(id)}?after=${after}&v=${v}${wait ? "&wait=1" : ""}`, { signal }),
    act: <T = { live: LiveView }>(id: string, action: "start" | "cancel" | "end" | "pin" | "hide" | "mute" | "block" | "settings" | "answer" | "done" | "skip" | "comment" | "video-token" | "video-on" | "video-off", body?: unknown) =>
      request<T>(`/api/v1/live/${encodeURIComponent(id)}/${action}`, json("POST", body ?? {})),
  },
  blocks: {
    list: (cursor?: string) => request<{ total: number; items: BlockRow[]; nextCursor: string | null }>(`/api/v1/astrologer/blocks${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
    unblock: (id: string) => request<{ ok: true }>(`/api/v1/astrologer/blocks/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },
  request,
};

export type ConsultInbox = { requests: SessionView[]; active: SessionView | null; live: { id: string; title: string; startedAt: string | null } | null; waiting: number; sig: string };
export type EarningsRules = { holdDays: number; minPayoutPaise: number; cycle: string; cycleWeekday: number; autoCreate: boolean; maxPerRequestPaise: number; tds: { enabled: boolean; ratePct: number; noPanRatePct: number }; requireVerifiedAccount: boolean; commissionPct: number };
export type TdsYear = { fy: string; payouts: number; grossPaise: number; tdsPaise: number };
export type WaitlistState = { open: boolean; entries: WaitEntryView[]; enabled: boolean; maxSize: number };
export type { EarningsBalance, LedgerEntry, Payout, WaitEntryView };

export type { LiveView, LiveEvent, LiveQueueItem };
export type BlockRow = { id: string; name: string; via: string; reason: string; at: string };

type SignInput = { agreementId: string; contentHash: string; typedName: string; keyPoints: string[]; scrolledToEnd: true };

/** Public directory client (storefront + reused by the mobile app contract). */
export const directoryApi = {
  list: (f: PublicListFilter = {}) => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "" && v !== false) p.set(k, v === true ? "1" : String(v)); });
    return request<{ items: PublicAstrologer[]; total: number; page: number; pageSize: number; onlineCount: number }>(`/api/v1/astrologers?${p.toString()}`);
  },
  get: (slug: string) => request<PublicAstrologer>(`/api/v1/astrologers/${encodeURIComponent(slug)}`),
};
