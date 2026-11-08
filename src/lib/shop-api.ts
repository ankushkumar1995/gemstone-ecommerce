/**
 * Storefront (customer-facing) API client. Thin typed wrappers over the public
 * API endpoints the storefront needs — currently placing orders at checkout.
 *
 * Kept separate from `admin-api.ts` so customer and admin concerns don't mix.
 */

import type { ApiResponse } from "@/core/http";
import type { Order, CreateOrderDto } from "@/modules/orders";
import type { Booking } from "@/modules/bookings";
import type { StoreSettings } from "@/modules/settings";
import type { CouponValidation, PublicCoupon } from "@/modules/coupons";
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
  poojas: {
    /** Open dates for a pooja (not past cutoff, not full). */
    slots: (slug: string) => request<import("@/modules/poojas/pooja.types").SlotView[]>(`/api/v1/poojas/${encodeURIComponent(slug)}/slots`),
    /** Booking request (no payment; the team calls to confirm). Retry-safe via requestId. */
    book: (dto: import("@/modules/poojas/pooja.schema").WebBookingInput) =>
      request<{ bookingNumber: string; pooja: string; package: string; date: string; time: string; label: string; total: number }>(
        "/api/v1/poojas/bookings",
        { method: "POST", body: JSON.stringify(dto) },
      ),
  },
  orders: {
    create: (dto: CreateOrderDto) =>
      request<Order>("/api/v1/orders", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
  },
  products: {
    /** All products (storefront list) — used to resolve wishlist ids → objects. */
    list: () => request<import("@/types").Product[]>("/api/v1/products"),
  },
  payments: {
    /** Whether online payment (Razorpay) is configured + available. */
    status: () => request<{ online: boolean; keyId?: string }>("/api/v1/payments/razorpay/status"),
    /** Create a pending order + Razorpay order; returns Checkout open data. */
    createRazorpayOrder: (dto: CreateOrderDto) =>
      request<{
        orderId: string;
        orderNumber: string;
        amount: number;
        currency: string;
        razorpayOrderId: string;
        keyId: string;
        customer: { name: string; email: string; phone?: string };
      }>("/api/v1/payments/razorpay/order", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    /** Verify the Checkout signature and settle the order. */
    verifyRazorpay: (payload: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }) =>
      request<{
        orderNumber: string;
        placedAt: string;
        paymentStatus: string;
        status: string;
        pricing: Order["pricing"];
        items: Order["items"];
      }>("/api/v1/payments/razorpay/verify", {
        method: "POST",
        body: JSON.stringify(payload),
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
  bookings: {
    /** My service bookings (logged-in customer). */
    mine: () => request<{ bookings: Booking[] }>("/api/v1/account/bookings"),
    /** Create a pending booking + Razorpay order; returns Checkout open data. */
    createRazorpay: (payload: {
      serviceId: string;
      intake: {
        fullName: string;
        phone: string;
        dob?: string;
        birthTime?: string;
        birthPlace?: string;
        gender?: string;
        maritalStatus?: string;
        message?: string;
      };
      preferredAt?: string;
      /** Guest checkout only; ignored by the server when signed in. */
      customer?: { name: string; email: string; phone?: string };
    }) =>
      request<{
        bookingId: string;
        bookingNumber: string;
        serviceTitle: string;
        amount: number;
        currency: string;
        razorpayOrderId: string;
        keyId: string;
        customer: { name: string; email: string; phone?: string };
      }>("/api/v1/payments/razorpay/booking", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    /** Verify the booking payment signature and settle it. */
    verifyRazorpay: (payload: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }) =>
      request<{
        bookingNumber: string;
        serviceTitle: string;
        placedAt: string;
        paymentStatus: string;
        status: string;
        amount: number;
      }>("/api/v1/payments/razorpay/booking-verify", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
  astrology: {
    cities: (q: string) =>
      request<Array<{ label: string; value: string }>>(
        `/api/v1/astrology/cities?q=${encodeURIComponent(q)}`,
      ),
    kundli: (payload: { name?: string; date: string; time: string; place: string }) =>
      request<import("@/types/astrology").KundliResponse>(
        "/api/v1/astrology/kundli",
        { method: "POST", body: JSON.stringify(payload) },
      ),
    matching: (payload: {
      boy: { name?: string; date: string; time: string; place: string };
      girl: { name?: string; date: string; time: string; place: string };
    }) =>
      request<import("@/types/astrology").MatchingResponse>(
        "/api/v1/astrology/matching",
        { method: "POST", body: JSON.stringify(payload) },
      ),
    report: (payload: { name?: string; date: string; time: string; place: string }) =>
      request<import("@/types/astrology").ReportResponse>(
        "/api/v1/astrology/report",
        { method: "POST", body: JSON.stringify(payload) },
      ),
  },
  coupons: {
    apply: (code: string, cartSubtotal: number) =>
      request<CouponValidation>("/api/v1/coupons/apply", {
        method: "POST",
        body: JSON.stringify({ code, cartSubtotal }),
      }),
    /** Public "Available offers" for the current cart subtotal. */
    available: (cartSubtotal: number) =>
      request<PublicCoupon[]>(`/api/v1/coupons/available?subtotal=${encodeURIComponent(cartSubtotal)}`),
  },
};
