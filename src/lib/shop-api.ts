/**
 * Storefront (customer-facing) API client. Thin typed wrappers over the public
 * API endpoints the storefront needs — currently placing orders at checkout.
 *
 * Kept separate from `admin-api.ts` so customer and admin concerns don't mix.
 */

import type { ApiResponse } from "@/core/http";
import type { Order, CreateOrderDto } from "@/modules/orders";
import type { StoreSettings } from "@/modules/settings";
import type { CouponValidation } from "@/modules/coupons";
import type { Article } from "@/types";

async function request<T>(
  url: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const body = (await res.json()) as ApiResponse<T>;
    if (body.success) return { ok: true, data: body.data };
    return { ok: false, message: body.error.message };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

export const shopApi = {
  orders: {
    create: (dto: CreateOrderDto) =>
      request<Order>("/api/v1/orders", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
  },
  settings: {
    get: () => request<StoreSettings>("/api/v1/settings"),
  },
  blog: {
    list: () => request<Article[]>("/api/v1/blog"),
    get: (slug: string) => request<Article>(`/api/v1/blog/${slug}`),
    related: (slug: string) => request<Article[]>(`/api/v1/blog/${slug}/related`),
  },
  coupons: {
    apply: (code: string, cartSubtotal: number) =>
      request<CouponValidation>("/api/v1/coupons/apply", {
        method: "POST",
        body: JSON.stringify({ code, cartSubtotal }),
      }),
  },
};
