/**
 * Admin client for the astrologer platform (astrologers, program settings,
 * and later consultations / wallets / payouts). Same envelope + transparent
 * admin token refresh as `admin-api.ts`, kept separate so that file stays small.
 */

import type { ApiResponse } from "@/core/http";
import type { Astrologer, AstrologerStatus, KycDocType } from "@/modules/astrologers/astrologer.types";
import type { AstroProgramSettings } from "@/modules/astro-settings/astro-settings";

export type AdminRes<T> = { ok: true; data: T } | { ok: false; message: string; details?: unknown };

async function request<T>(url: string, init?: RequestInit, retried = false): Promise<AdminRes<T>> {
  try {
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
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

export type AdminAstrologer = Astrologer & { effectiveCommissionPct: number; effectiveMaxRate: number; kycComplete: boolean };

export const astroAdminApi = {
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
  settings: {
    get: () => request<AstroProgramSettings>("/api/v1/admin/astro-settings"),
    update: (data: Partial<AstroProgramSettings>) => request<AstroProgramSettings>("/api/v1/admin/astro-settings", json("PATCH", data)),
  },
  request,
};
