/**
 * Admin-side API client. Thin typed wrappers over the admin endpoints.
 */

import type { ApiResponse } from "@/core/http";
import type { AdminUser } from "@/modules/admin-auth";
import type { Lead } from "@/modules/leads";
import type { CreateProductDto, UpdateProductDto } from "@/modules/products";
import type { CreateCollectionDto, UpdateCollectionDto } from "@/modules/collections";
import type { CreateCategoryDto, UpdateCategoryDto } from "@/modules/categories";
import type {
  Customer,
  CreateCustomerDto,
  UpdateCustomerDto,
} from "@/modules/customers";
import type {
  Order,
  OrderStatus,
  PaymentStatus,
  CreateOrderDto,
  UpdateFulfillmentDto,
  UpdateOrderDetailsDto,
} from "@/modules/orders";
import type { StoreSettings, UpdateSettingsDto } from "@/modules/settings";
import type { CreateArticleDto, UpdateArticleDto } from "@/modules/blog";
import type { Coupon, CreateCouponDto, UpdateCouponDto } from "@/modules/coupons";
import type { CmsPage, CreatePageDto, UpdatePageDto } from "@/modules/pages";
import type { Banner, CreateBannerDto, UpdateBannerDto } from "@/modules/banners";
import type { SalesReport } from "@/modules/reports";
import type {
  ReturnRequest,
  CreateReturnDto,
  UpdateReturnStatusDto,
} from "@/modules/returns";
import type { Review, UpdateReviewDto } from "@/modules/reviews";
import type { AuditEntry } from "@/modules/audit";
import type { PaymentsReport } from "@/modules/payments";
import type { CreateServiceDto, UpdateServiceDto } from "@/modules/services";
import type { Product, Collection, Category, Article, AstroService } from "@/types";

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

export const adminApi = {
  login: (email: string, password: string) =>
    request<{ user: AdminUser }>("/api/v1/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () =>
    request<{ loggedOut: boolean }>("/api/v1/admin/logout", { method: "POST" }),
  leads: {
    list: () => request<Lead[]>("/api/v1/leads"),
    updateStatus: (id: string, status: Lead["status"]) =>
      request<Lead>(`/api/v1/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
  },
  products: {
    list: () => request<Product[]>("/api/v1/products"),
    create: (dto: CreateProductDto) =>
      request<Product>("/api/v1/products", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    update: (id: string, dto: UpdateProductDto) =>
      request<Product>(`/api/v1/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
    remove: (id: string) =>
      request<{ id: string }>(`/api/v1/products/${id}`, { method: "DELETE" }),
  },
  collections: {
    list: () => request<Collection[]>("/api/v1/collections"),
    create: (dto: CreateCollectionDto) =>
      request<Collection>("/api/v1/collections", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    update: (id: string, dto: UpdateCollectionDto) =>
      request<Collection>(`/api/v1/collections/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
    remove: (id: string) =>
      request<{ id: string }>(`/api/v1/collections/${id}`, { method: "DELETE" }),
  },
  categories: {
    list: () => request<Category[]>("/api/v1/categories"),
    create: (dto: CreateCategoryDto) =>
      request<Category>("/api/v1/categories", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    update: (id: string, dto: UpdateCategoryDto) =>
      request<Category>(`/api/v1/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
    remove: (id: string) =>
      request<{ id: string }>(`/api/v1/categories/${id}`, { method: "DELETE" }),
  },
  customers: {
    list: () => request<Customer[]>("/api/v1/customers"),
    get: (id: string) => request<Customer>(`/api/v1/customers/${id}`),
    create: (dto: CreateCustomerDto) =>
      request<Customer>("/api/v1/customers", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    update: (id: string, dto: UpdateCustomerDto) =>
      request<Customer>(`/api/v1/customers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
    addNote: (id: string, note: string) =>
      request<Customer>(`/api/v1/customers/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
    remove: (id: string) =>
      request<{ id: string }>(`/api/v1/customers/${id}`, { method: "DELETE" }),
  },
  orders: {
    list: () => request<Order[]>("/api/v1/orders"),
    get: (id: string) => request<Order>(`/api/v1/orders/${id}`),
    create: (dto: CreateOrderDto) =>
      request<Order>("/api/v1/orders", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    updateStatus: (id: string, status: OrderStatus) =>
      request<Order>(`/api/v1/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    updatePayment: (id: string, paymentStatus: PaymentStatus) =>
      request<Order>(`/api/v1/orders/${id}/payment`, {
        method: "PATCH",
        body: JSON.stringify({ paymentStatus }),
      }),
    updateFulfillment: (id: string, dto: UpdateFulfillmentDto) =>
      request<Order>(`/api/v1/orders/${id}/fulfillment`, {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
    addNote: (id: string, note: string) =>
      request<Order>(`/api/v1/orders/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
    updateDetails: (id: string, dto: UpdateOrderDetailsDto) =>
      request<Order>(`/api/v1/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
  },
  settings: {
    get: () => request<StoreSettings>("/api/v1/settings"),
    update: (dto: UpdateSettingsDto) =>
      request<StoreSettings>("/api/v1/settings", {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
  },
  articles: {
    list: () => request<Article[]>("/api/v1/articles"),
    get: (id: string) => request<Article>(`/api/v1/articles/${id}`),
    create: (dto: CreateArticleDto) =>
      request<Article>("/api/v1/articles", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    update: (id: string, dto: UpdateArticleDto) =>
      request<Article>(`/api/v1/articles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
    remove: (id: string) =>
      request<{ id: string }>(`/api/v1/articles/${id}`, { method: "DELETE" }),
  },
  coupons: {
    list: () => request<Coupon[]>("/api/v1/coupons"),
    get: (id: string) => request<Coupon>(`/api/v1/coupons/${id}`),
    create: (dto: CreateCouponDto) =>
      request<Coupon>("/api/v1/coupons", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    update: (id: string, dto: UpdateCouponDto) =>
      request<Coupon>(`/api/v1/coupons/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
    remove: (id: string) =>
      request<{ id: string }>(`/api/v1/coupons/${id}`, { method: "DELETE" }),
  },
  pages: {
    list: () => request<CmsPage[]>("/api/v1/pages"),
    get: (id: string) => request<CmsPage>(`/api/v1/pages/${id}`),
    create: (dto: CreatePageDto) =>
      request<CmsPage>("/api/v1/pages", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    update: (id: string, dto: UpdatePageDto) =>
      request<CmsPage>(`/api/v1/pages/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
    remove: (id: string) =>
      request<{ id: string }>(`/api/v1/pages/${id}`, { method: "DELETE" }),
  },
  banners: {
    list: () => request<Banner[]>("/api/v1/banners"),
    get: (id: string) => request<Banner>(`/api/v1/banners/${id}`),
    create: (dto: CreateBannerDto) =>
      request<Banner>("/api/v1/banners", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    update: (id: string, dto: UpdateBannerDto) =>
      request<Banner>(`/api/v1/banners/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
    remove: (id: string) =>
      request<{ id: string }>(`/api/v1/banners/${id}`, { method: "DELETE" }),
  },
  reports: {
    sales: (from?: string, to?: string) => {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const q = qs.toString();
      return request<SalesReport>(`/api/v1/reports/sales${q ? `?${q}` : ""}`);
    },
  },
  returns: {
    list: () => request<ReturnRequest[]>("/api/v1/returns"),
    get: (id: string) => request<ReturnRequest>(`/api/v1/returns/${id}`),
    create: (dto: CreateReturnDto) =>
      request<ReturnRequest>("/api/v1/returns", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    updateStatus: (id: string, dto: UpdateReturnStatusDto) =>
      request<ReturnRequest>(`/api/v1/returns/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
    addNote: (id: string, note: string) =>
      request<ReturnRequest>(`/api/v1/returns/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
  },
  reviews: {
    list: () => request<Review[]>("/api/v1/reviews"),
    get: (id: string) => request<Review>(`/api/v1/reviews/${id}`),
    update: (id: string, dto: UpdateReviewDto) =>
      request<Review>(`/api/v1/reviews/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
    remove: (id: string) =>
      request<{ id: string }>(`/api/v1/reviews/${id}`, { method: "DELETE" }),
  },
  audit: {
    list: (filters?: { entity?: string; action?: string; q?: string }) => {
      const qs = new URLSearchParams();
      if (filters?.entity) qs.set("entity", filters.entity);
      if (filters?.action) qs.set("action", filters.action);
      if (filters?.q) qs.set("q", filters.q);
      const q = qs.toString();
      return request<AuditEntry[]>(`/api/v1/audit${q ? `?${q}` : ""}`);
    },
  },
  payments: {
    report: (filters?: { status?: string; method?: string; from?: string; to?: string; q?: string }) => {
      const qs = new URLSearchParams();
      if (filters?.status) qs.set("status", filters.status);
      if (filters?.method) qs.set("method", filters.method);
      if (filters?.from) qs.set("from", filters.from);
      if (filters?.to) qs.set("to", filters.to);
      if (filters?.q) qs.set("q", filters.q);
      const q = qs.toString();
      return request<PaymentsReport>(`/api/v1/payments${q ? `?${q}` : ""}`);
    },
  },
  services: {
    list: () => request<AstroService[]>("/api/v1/services"),
    get: (id: string) => request<AstroService>(`/api/v1/services/${id}`),
    create: (dto: CreateServiceDto) =>
      request<AstroService>("/api/v1/services", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    update: (id: string, dto: UpdateServiceDto) =>
      request<AstroService>(`/api/v1/services/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
    remove: (id: string) =>
      request<{ id: string }>(`/api/v1/services/${id}`, { method: "DELETE" }),
  },
};
