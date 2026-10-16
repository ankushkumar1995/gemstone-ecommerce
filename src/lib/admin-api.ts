/**
 * Admin-side API client. Thin typed wrappers over the admin endpoints.
 */

import type { ApiResponse } from "@/core/http";
import type { AdminUser } from "@/modules/admin-auth";
import type { Lead } from "@/modules/leads";
import type {
  CreateProductDto,
  UpdateProductDto,
  AddVariantDto,
  UpdateVariantDto,
} from "@/modules/products";
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
import type { Booking, BookingStatus, BookingPaymentStatus } from "@/modules/bookings";
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
import type { ResolvedUser, Role, CreateUserDto, UpdateUserDto } from "@/modules/users";
import type { Product, Collection, Category, Article, AstroService } from "@/types";

async function request<T>(
  url: string,
  init?: RequestInit,
  _retried = false,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });

    // Access token expired (15 min)? Transparently refresh once, then retry.
    if (res.status === 401 && !_retried && !url.includes("/admin/refresh") && !url.includes("/admin/login")) {
      const refreshed = await fetch("/api/v1/admin/refresh", { method: "POST" });
      if (refreshed.ok) return request<T>(url, init, true);
    }

    const body = (await res.json()) as ApiResponse<T>;
    if (body.success) return { ok: true, data: body.data };
    return { ok: false, message: body.error.message };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

export const adminApi = {
  login: (email: string, password: string) =>
    request<{ user: AdminUser; mustChangePassword: boolean }>("/api/v1/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () =>
    request<{ loggedOut: boolean }>("/api/v1/admin/logout", { method: "POST" }),
  me: () => request<{ user: AdminUser }>("/api/v1/admin/me"),
  changePassword: (newPassword: string, currentPassword?: string) =>
    request<{ changed: boolean }>("/api/v1/admin/change-password", {
      method: "POST",
      body: JSON.stringify({ newPassword, currentPassword }),
    }),
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
    getBySlug: (slug: string) => request<Product>(`/api/v1/products/slug/${slug}`),
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
    setStatus: (id: string, status: "draft" | "active" | "archived") =>
      request<Product>(`/api/v1/products/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    adjustStock: (
      id: string,
      body: { delta?: number; set?: number; variantSku?: string; reason?: string },
    ) =>
      request<Product>(`/api/v1/products/${id}/stock`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    duplicate: (id: string) =>
      request<Product>(`/api/v1/products/${id}/duplicate`, { method: "POST" }),
    restore: (id: string) =>
      request<Product>(`/api/v1/products/${id}/restore`, { method: "POST" }),
    listDeleted: () => request<Product[]>("/api/v1/products/deleted"),
    lowStock: (outOnly = false) =>
      request<Product[]>(`/api/v1/products/low-stock${outOnly ? "?outOnly=true" : ""}`),
    bulkPrice: (body: {
      ids: string[];
      mode: "percent" | "amount" | "set";
      value: number;
      applyToMrp?: boolean;
      roundTo?: number;
    }) =>
      request<{ count: number }>("/api/v1/products/bulk-price", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    bulk: (ids: string[], action: "status" | "delete" | "feature", value?: string | boolean) =>
      request<{ count: number }>("/api/v1/products/bulk", {
        method: "POST",
        body: JSON.stringify({ ids, action, value }),
      }),
    remove: (id: string) =>
      request<{ id: string }>(`/api/v1/products/${id}`, { method: "DELETE" }),

    /* variant-level CRUD */
    addVariant: (id: string, variant: AddVariantDto) =>
      request<Product>(`/api/v1/products/${id}/variants`, {
        method: "POST",
        body: JSON.stringify(variant),
      }),
    updateVariant: (id: string, sku: string, patch: UpdateVariantDto) =>
      request<Product>(`/api/v1/products/${id}/variants/${encodeURIComponent(sku)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    removeVariant: (id: string, sku: string) =>
      request<Product>(`/api/v1/products/${id}/variants/${encodeURIComponent(sku)}`, {
        method: "DELETE",
      }),

    /* rollup counters */
    incView: (id: string) =>
      request<Product>(`/api/v1/products/${id}/view`, { method: "POST" }),
    incCounter: (id: string, counter: "view" | "sold", by = 1) =>
      request<Product>(`/api/v1/products/${id}/counter`, {
        method: "POST",
        body: JSON.stringify({ counter, by }),
      }),
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
    getBySlug: (slug: string) => request<Category>(`/api/v1/categories/slug/${slug}`),
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
    setStatus: (id: string, status: "active" | "inactive") =>
      request<Category>(`/api/v1/categories/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    reorder: (ids: string[]) =>
      request<{ count: number }>("/api/v1/categories/reorder", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    restore: (id: string) =>
      request<Category>(`/api/v1/categories/${id}/restore`, { method: "POST" }),
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
  bookings: {
    list: () => request<Booking[]>("/api/v1/bookings"),
    counts: () => request<{ pending: number; active: number; total: number }>("/api/v1/bookings/counts"),
    get: (id: string) => request<Booking>(`/api/v1/bookings/${id}`),
    updateStatus: (id: string, status: BookingStatus) =>
      request<Booking>(`/api/v1/bookings/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    updatePayment: (id: string, paymentStatus: BookingPaymentStatus) =>
      request<Booking>(`/api/v1/bookings/${id}/payment`, {
        method: "PATCH",
        body: JSON.stringify({ paymentStatus }),
      }),
    schedule: (id: string, scheduledAt: string) =>
      request<Booking>(`/api/v1/bookings/${id}/schedule`, {
        method: "PATCH",
        body: JSON.stringify({ scheduledAt }),
      }),
    addNote: (id: string, note: string) =>
      request<Booking>(`/api/v1/bookings/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
    setAdminNotes: (id: string, adminNotes: string) =>
      request<Booking>(`/api/v1/bookings/${id}/notes`, {
        method: "PATCH",
        body: JSON.stringify({ adminNotes }),
      }),
    remove: (id: string) =>
      request<{ id: string }>(`/api/v1/bookings/${id}`, { method: "DELETE" }),
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
    toggle: (id: string, active: boolean) =>
      request<Coupon>(`/api/v1/coupons/${id}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      }),
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
  users: {
    list: () => request<ResolvedUser[]>("/api/v1/users"),
    get: (id: string) => request<ResolvedUser>(`/api/v1/users/${id}`),
    create: (dto: CreateUserDto) =>
      request<{ user: ResolvedUser; tempPassword?: string }>("/api/v1/users", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    resetPassword: (id: string, password?: string) =>
      request<{ tempPassword?: string }>(`/api/v1/users/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password }),
      }),
    update: (id: string, dto: UpdateUserDto) =>
      request<ResolvedUser>(`/api/v1/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
    setStatus: (id: string, status: ResolvedUser["status"], reason?: string) =>
      request<ResolvedUser>(`/api/v1/users/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      }),
    restore: (id: string) =>
      request<ResolvedUser>(`/api/v1/users/${id}/restore`, { method: "POST" }),
    unlock: (id: string) =>
      request<ResolvedUser>(`/api/v1/users/${id}/unlock`, { method: "POST" }),
    remove: (id: string) =>
      request<{ id: string }>(`/api/v1/users/${id}`, { method: "DELETE" }),
  },
  roles: {
    list: () => request<Role[]>("/api/v1/roles"),
  },
  storage: {
    /** Upload a file to S3 via the server. Returns the public URL + key. */
    async upload(file: File, folder = "media") {
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("folder", folder);
        // Note: no Content-Type header — the browser sets the multipart boundary.
        const res = await fetch("/api/v1/storage/upload", { method: "POST", body: form });
        const body = (await res.json()) as
          | { success: true; data: { key: string; url: string; size: number; contentType: string } }
          | { success: false; error: { message: string } };
        if (body.success) return { ok: true as const, data: body.data };
        return { ok: false as const, message: body.error.message };
      } catch {
        return { ok: false as const, message: "Upload failed. Please try again." };
      }
    },
    /**
     * Upload a (possibly large) file DIRECTLY to S3 using a presigned PUT URL.
     * Bytes never pass through our server — best for videos. Returns the final
     * public URL.
     */
    async uploadDirect(file: File, folder = "media") {
      try {
        // 1) ask the server for a presigned PUT ticket
        const presign = await request<{
          key: string;
          url: string;
          publicUrl: string;
          expiresIn: number;
          headers: Record<string, string>;
        }>("/api/v1/storage/presign", {
          method: "POST",
          body: JSON.stringify({
            folder,
            fileName: file.name || "upload",
            contentType: file.type || "application/octet-stream",
          }),
        });
        if (!presign.ok) return { ok: false as const, message: presign.message };

        // 2) PUT the bytes straight to S3
        const put = await fetch(presign.data.url, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream", ...presign.data.headers },
          body: file,
        });
        if (!put.ok) return { ok: false as const, message: `Upload to storage failed (${put.status})` };

        return { ok: true as const, data: { url: presign.data.publicUrl, key: presign.data.key, size: file.size, contentType: file.type } };
      } catch {
        return { ok: false as const, message: "Upload failed. Please try again." };
      }
    },
    list: (folder = "") =>
      request<{ folder: string; objects: Array<{ key: string; url: string; size: number; name: string }>; subfolders: string[] }>(
        `/api/v1/storage${folder ? `?folder=${encodeURIComponent(folder)}` : ""}`,
      ),
    remove: (key: string) =>
      request<{ deleted: string[] }>("/api/v1/storage", {
        method: "DELETE",
        body: JSON.stringify({ key }),
      }),
  },
};
