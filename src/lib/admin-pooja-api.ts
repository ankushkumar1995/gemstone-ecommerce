/**
 * Admin client for the Pooja section. Reuses the envelope + token refresh of
 * the astrologer admin client. Imports only types (no server code).
 */

import { astroAdminApi } from "@/lib/admin-astro-api";
import type { BookingAction, AdminBookingInput, CategoryCreateInput, CategoryUpdateInput, PanditInput, PoojaInput } from "@/modules/poojas/pooja.schema";
import type { Pandit, Pooja, PoojaBooking, PoojaBookingStatus, PoojaCategoryItem, PoojaCategoryRow, PoojaListItem, PoojaStatus, SlotView } from "@/modules/poojas/pooja.types";

const request = astroAdminApi.request;
const json = (method: string, data?: unknown): RequestInit => ({ method, body: data === undefined ? undefined : JSON.stringify(data) });

export interface BookingCounts { today: number; unpaid: number; needsPandit: number; proofPending: number; proofLate: number; prasadToShip: number; prasadLate: number; toComplete: number }
export interface RefundSuggestion { refundable: number; pct: number; amount: number }

export const poojaAdminApi = {
  poojas: {
    list: () => request<PoojaListItem[]>("/api/v1/admin/poojas"),
    get: (id: string) => request<Pooja>(`/api/v1/admin/poojas/${id}`),
    create: (data: PoojaInput) => request<Pooja>("/api/v1/admin/poojas", json("POST", data)),
    save: (id: string, data: PoojaInput) => request<Pooja>(`/api/v1/admin/poojas/${id}`, json("PUT", data)),
    setStatus: (id: string, status: PoojaStatus) => request<Pooja>(`/api/v1/admin/poojas/${id}`, json("PATCH", { status })),
    duplicate: (id: string) => request<Pooja>(`/api/v1/admin/poojas/${id}/duplicate`, json("POST")),
    remove: (id: string) => request<{ id: string }>(`/api/v1/admin/poojas/${id}`, json("DELETE")),
    availability: (id: string, from?: string, days = 30) => request<SlotView[]>(`/api/v1/admin/poojas/${id}/availability?days=${days}${from ? `&from=${from}` : ""}`),
  },
  bookings: {
    list: (f: { status?: PoojaBookingStatus[]; poojaId?: string; panditId?: string; from?: string; to?: string; q?: string } = {}) => {
      const p = new URLSearchParams();
      if (f.status?.length) p.set("status", f.status.join(","));
      for (const k of ["poojaId", "panditId", "from", "to", "q"] as const) if (f[k]) p.set(k, f[k]!);
      return request<PoojaBooking[]>(`/api/v1/admin/pooja-bookings?${p.toString()}`);
    },
    counts: () => request<BookingCounts>("/api/v1/admin/pooja-bookings/counts"),
    get: (id: string) => request<{ booking: PoojaBooking; refund: RefundSuggestion }>(`/api/v1/admin/pooja-bookings/${id}`),
    create: (data: AdminBookingInput) => request<PoojaBooking>("/api/v1/admin/pooja-bookings", json("POST", data)),
    act: (id: string, action: BookingAction) => request<PoojaBooking>(`/api/v1/admin/pooja-bookings/${id}`, json("POST", action)),
  },
  categories: {
    list: () => request<PoojaCategoryRow[]>("/api/v1/admin/pooja-categories"),
    create: (data: CategoryCreateInput) => request<PoojaCategoryItem>("/api/v1/admin/pooja-categories", json("POST", data)),
    update: (key: string, data: CategoryUpdateInput) => request<PoojaCategoryItem>(`/api/v1/admin/pooja-categories/${encodeURIComponent(key)}`, json("PATCH", data)),
    reorder: (keys: string[]) => request<PoojaCategoryRow[]>("/api/v1/admin/pooja-categories", json("PUT", { keys })),
    remove: (key: string) => request<{ key: string }>(`/api/v1/admin/pooja-categories/${encodeURIComponent(key)}`, json("DELETE")),
    merge: (key: string, into: string) => request<{ moved: number; into: PoojaCategoryItem }>(`/api/v1/admin/pooja-categories/${encodeURIComponent(key)}`, json("POST", { into })),
  },
  pandits: {
    list: () => request<Pandit[]>("/api/v1/admin/pandits"),
    create: (data: PanditInput) => request<Pandit>("/api/v1/admin/pandits", json("POST", data)),
    save: (id: string, data: PanditInput) => request<Pandit>(`/api/v1/admin/pandits/${id}`, json("PUT", data)),
    remove: (id: string) => request<{ id: string }>(`/api/v1/admin/pandits/${id}`, json("DELETE")),
  },
};

/** A fresh id for retry-safe admin requests (refunds, cancellations, bookings). */
export const newRequestId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
