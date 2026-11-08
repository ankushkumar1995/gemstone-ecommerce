/** Admin client for service categories (same envelope + token refresh as the other admin clients). */

import { astroAdminApi } from "@/lib/admin-astro-api";
import type { CreateServiceCategoryDto, UpdateServiceCategoryDto } from "@/modules/services/service.schema";
import type { ServiceCategory, ServiceCategoryList } from "@/modules/services/service-category.types";

const request = astroAdminApi.request;
const json = (method: string, data?: unknown): RequestInit => ({ method, body: data === undefined ? undefined : JSON.stringify(data) });

export const serviceCategoryApi = {
  list: () => request<ServiceCategoryList>("/api/v1/admin/service-categories"),
  create: (dto: CreateServiceCategoryDto) => request<ServiceCategory>("/api/v1/admin/service-categories", json("POST", dto)),
  update: (id: string, dto: UpdateServiceCategoryDto) => request<ServiceCategory>(`/api/v1/admin/service-categories/${id}`, json("PATCH", dto)),
  reorder: (ids: string[]) => request<ServiceCategoryList>("/api/v1/admin/service-categories", json("PUT", { ids })),
  /** moveTo: another category id, or null for Uncategorised. */
  remove: (id: string, moveTo?: string | null) => request<{ id: string; moved: number }>(`/api/v1/admin/service-categories/${id}`, json("DELETE", moveTo === undefined ? {} : { moveTo })),
};
