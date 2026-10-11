/**
 * Frontend API client.
 *
 * A small typed wrapper over `fetch` that understands our API envelope
 * ({ success, data } | { success, error }). Components call these helpers
 * instead of using fetch directly, so error handling stays consistent.
 */

import type { ApiResponse } from "@/core/http";
import type { CreateLeadInput, Lead } from "@/modules/leads";

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
};
