/**
 * Partner (astrologer) panel API client. Transparently refreshes the 15-minute
 * access token once on a 401, then retries; concurrent 401s share one refresh.
 * Type-only imports from server modules keep this safe for client bundles.
 */

import type { ApiResponse } from "@/core/http";
import type { SelfAstrologer, PublicAstrologer, PublicListFilter } from "@/modules/astrologers/astrologer.types";
import type { AstroIdentity } from "@/modules/astrologer-auth/astrologer-auth.service";

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
  request,
};

/** Public directory client (storefront + reused by the mobile app contract). */
export const directoryApi = {
  list: (f: PublicListFilter = {}) => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "" && v !== false) p.set(k, v === true ? "1" : String(v)); });
    return request<{ items: PublicAstrologer[]; total: number; page: number; pageSize: number; onlineCount: number }>(`/api/v1/astrologers?${p.toString()}`);
  },
  get: (slug: string) => request<PublicAstrologer>(`/api/v1/astrologers/${encodeURIComponent(slug)}`),
};
