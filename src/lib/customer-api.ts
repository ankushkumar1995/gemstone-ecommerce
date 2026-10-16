/**
 * Customer (storefront) API client. Thin typed wrappers over /api/v1/account/*
 * with transparent one-shot refresh on 401 (access token lives 15 min).
 */

import type { CustomerPublic } from "@/modules/customer-auth";
import type { CustomerAddress } from "@/modules/customers";
import type { Order } from "@/modules/orders";

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; message: string };

/** Payload accepted when creating/updating an address from the account UI. */
export interface AddressPayload {
  label?: string;
  name?: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
}

async function request<T>(
  url: string,
  init?: RequestInit,
  _retried = false,
): Promise<Ok<T> | Err> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });

    // Access token expired? Transparently refresh once, then retry.
    if (
      res.status === 401 &&
      !_retried &&
      !url.includes("/account/refresh") &&
      !url.includes("/account/login") &&
      !url.includes("/account/register")
    ) {
      const refreshed = await fetch("/api/v1/account/refresh", { method: "POST" });
      if (refreshed.ok) return request<T>(url, init, true);
    }

    const body = (await res.json()) as
      | { success: true; data: T }
      | { success: false; error: { message: string } };
    if (body.success) return { ok: true, data: body.data };
    return { ok: false, message: body.error.message };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

export const customerApi = {
  register: (input: { name: string; email: string; password: string; phone?: string }) =>
    request<{ customer: CustomerPublic }>("/api/v1/account/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  login: (email: string, password: string) =>
    request<{ customer: CustomerPublic }>("/api/v1/account/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<{ ok: boolean }>("/api/v1/account/logout", { method: "POST" }),

  me: () => request<{ customer: CustomerPublic }>("/api/v1/account/me"),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/api/v1/account/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  forgotPassword: (email: string) =>
    request<{ sent: boolean }>("/api/v1/account/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    request<{ ok: boolean }>("/api/v1/account/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    }),

  /* ───────── profile ───────── */
  updateProfile: (patch: { name?: string; phone?: string }) =>
    request<{ profile: { id: string; name: string; phone?: string } }>("/api/v1/account/profile", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  /* ───────── orders ───────── */
  orders: () => request<{ orders: Order[] }>("/api/v1/account/orders"),
  order: (id: string) => request<{ order: Order }>(`/api/v1/account/orders/${id}`),
  cancelOrder: (id: string) =>
    request<{ orderNumber: string; status: string; paymentStatus: string }>(
      `/api/v1/account/orders/${id}/cancel`,
      { method: "POST" },
    ),

  /* ───────── addresses ───────── */
  addresses: {
    list: () => request<{ addresses: CustomerAddress[] }>("/api/v1/account/addresses"),
    add: (payload: AddressPayload) =>
      request<{ addresses: CustomerAddress[] }>("/api/v1/account/addresses", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: AddressPayload) =>
      request<{ addresses: CustomerAddress[] }>(`/api/v1/account/addresses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    setDefault: (id: string) =>
      request<{ addresses: CustomerAddress[] }>(`/api/v1/account/addresses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "setDefault" }),
      }),
    remove: (id: string) =>
      request<{ addresses: CustomerAddress[] }>(`/api/v1/account/addresses/${id}`, {
        method: "DELETE",
      }),
  },

  /* ───────── wishlist ───────── */
  wishlist: {
    list: () => request<{ wishlist: string[] }>("/api/v1/account/wishlist"),
    add: (productId: string) =>
      request<{ wishlist: string[] }>("/api/v1/account/wishlist", {
        method: "POST",
        body: JSON.stringify({ productId }),
      }),
    remove: (productId: string) =>
      request<{ wishlist: string[] }>("/api/v1/account/wishlist", {
        method: "DELETE",
        body: JSON.stringify({ productId }),
      }),
  },
};
