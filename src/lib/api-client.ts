/**
 * Frontend API client.
 *
 * A small typed wrapper over `fetch` that understands our API envelope
 * ({ success, data } | { success, error }). Components call these helpers
 * instead of using fetch directly, so error handling stays consistent.
 */

import type { ApiResponse } from "@/core/http";
import type { CreateLeadInput, Lead } from "@/modules/leads";
import type { PopupEvent, PublicPopup } from "@/modules/popups";

async function request<T>(
  url: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; message: string; details?: unknown }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const body = (await res.json()) as ApiResponse<T>;
    if (body.success) return { ok: true, data: body.data };
    return { ok: false, message: body.error.message, details: body.error.details };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

export const api = {
  leads: {
    create: (input: CreateLeadInput) =>
      request<Lead>("/api/v1/leads", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    list: () => request<Lead[]>("/api/v1/leads"),
    updateStatus: (id: string, status: Lead["status"]) =>
      request<Lead>(`/api/v1/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
  },
  popups: {
    live: () => request<PublicPopup[]>("/api/v1/popups/live"),
    submit: (input: { popupId: string; email: string; name?: string; phone?: string; message?: string }) =>
      request<{ ok: true }>("/api/v1/popups/submit", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    /**
     * Fire-and-forget analytics. Uses sendBeacon when available so it survives
     * navigation; falls back to keepalive fetch. Never awaited by the UI.
     */
    track: (popupId: string, event: PopupEvent) => {
      const payload = JSON.stringify({ popupId, event });
      try {
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          const blob = new Blob([payload], { type: "application/json" });
          navigator.sendBeacon("/api/v1/popups/event", blob);
          return;
        }
      } catch {
        /* fall through to fetch */
      }
      void fetch("/api/v1/popups/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    },
  },
};
