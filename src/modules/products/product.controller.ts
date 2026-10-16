/**
 * Products domain — controller. Validates input and bridges HTTP ⇄ service.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import { parseListParams, type Paginated } from "@/core/query";
import {
  createProductSchema,
  updateProductSchema,
  setProductStatusSchema,
  adjustStockSchema,
  bulkSchema,
  bulkPriceSchema,
  addVariantSchema,
  updateVariantSchema,
  incCounterSchema,
} from "./product.schema";
import { productService } from "./product.service";
import type { ProductSearchFilters } from "./product.types";
import type { Product } from "@/types";

/** Sort keys a client is allowed to sort the product list by. */
const SORTABLE = [
  "displayOrder",
  "name",
  "slug",
  "price",
  "stockQty",
  "ratingAvg",
  "soldCount",
  "createdAt",
  "updatedAt",
];

/** Pull the supported product filters out of a query string. */
function parseFilters(sp: URLSearchParams): ProductSearchFilters {
  const filters: ProductSearchFilters = {};
  const categoryId = sp.get("categoryId");
  if (categoryId) filters.categoryId = categoryId;
  const status = sp.get("status");
  if (status === "draft" || status === "active" || status === "archived") filters.status = status;
  if (sp.has("featured")) filters.featured = sp.get("featured") === "true";
  if (sp.has("inStock")) filters.inStock = sp.get("inStock") === "true";
  const tag = sp.get("tag");
  if (tag) filters.tag = tag;
  const min = sp.get("minPrice");
  if (min !== null && !Number.isNaN(Number(min))) filters.minPrice = Number(min);
  const max = sp.get("maxPrice");
  if (max !== null && !Number.isNaN(Number(max))) filters.maxPrice = Number(max);
  return filters;
}

export const productController = {
  async list(): Promise<NextResponse<ApiResponse<Product[]>>> {
    return toResponse(await productService.list());
  },

  async listDeleted(): Promise<NextResponse<ApiResponse<Product[]>>> {
    return toResponse(await productService.listDeleted());
  },

  async listLowStock(sp: URLSearchParams): Promise<NextResponse<ApiResponse<Product[]>>> {
    const outOnly = sp.get("outOnly") === "true";
    return toResponse(await productService.listLowStock({ outOnly }));
  },

  async listPaginated(
    searchParams: URLSearchParams,
  ): Promise<NextResponse<ApiResponse<Paginated<Product>>>> {
    const params = parseListParams(searchParams, {
      defaultSort: { displayOrder: 1, createdAt: -1 },
      allowedSortKeys: SORTABLE,
    });
    return toResponse(await productService.listPaginated(params, parseFilters(searchParams)));
  },

  async get(id: string): Promise<NextResponse<ApiResponse<Product>>> {
    return toResponse(await productService.getById(id));
  },

  async getBySlug(slug: string): Promise<NextResponse<ApiResponse<Product>>> {
    return toResponse(await productService.getBySlug(slug));
  },

  async create(body: unknown): Promise<NextResponse<ApiResponse<Product>>> {
    const parsed = parse(createProductSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await productService.create(parsed.value), 201);
  },

  async update(id: string, body: unknown): Promise<NextResponse<ApiResponse<Product>>> {
    const parsed = parse(updateProductSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await productService.update(id, parsed.value));
  },

  async setStatus(id: string, body: unknown): Promise<NextResponse<ApiResponse<Product>>> {
    const parsed = parse(setProductStatusSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await productService.setStatus(id, parsed.value.status));
  },

  async adjustStock(id: string, body: unknown): Promise<NextResponse<ApiResponse<Product>>> {
    const parsed = parse(adjustStockSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await productService.adjustStockApi(id, parsed.value));
  },

  async duplicate(id: string): Promise<NextResponse<ApiResponse<Product>>> {
    return toResponse(await productService.duplicate(id), 201);
  },

  async bulk(body: unknown): Promise<NextResponse<ApiResponse<{ count: number }>>> {
    const parsed = parse(bulkSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await productService.bulkUpdate(parsed.value));
  },

  async bulkPrice(body: unknown): Promise<NextResponse<ApiResponse<{ count: number }>>> {
    const parsed = parse(bulkPriceSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await productService.bulkPriceUpdate(parsed.value));
  },

  async remove(id: string): Promise<NextResponse<ApiResponse<{ id: string }>>> {
    return toResponse(await productService.remove(id));
  },

  async restore(id: string): Promise<NextResponse<ApiResponse<Product>>> {
    return toResponse(await productService.restore(id));
  },

  /* ---- variant-level CRUD ---- */

  async addVariant(id: string, body: unknown): Promise<NextResponse<ApiResponse<Product>>> {
    const parsed = parse(addVariantSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await productService.addVariant(id, parsed.value), 201);
  },

  async updateVariant(
    id: string,
    sku: string,
    body: unknown,
  ): Promise<NextResponse<ApiResponse<Product>>> {
    const parsed = parse(updateVariantSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await productService.updateVariant(id, sku, parsed.value));
  },

  async removeVariant(id: string, sku: string): Promise<NextResponse<ApiResponse<Product>>> {
    return toResponse(await productService.removeVariant(id, sku));
  },

  /* ---- rollup-counter increments (view / sold) ---- */

  async incrementCounter(id: string, body: unknown): Promise<NextResponse<ApiResponse<Product>>> {
    const parsed = parse(incCounterSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(
      await productService.incrementCounter(id, parsed.value.counter, parsed.value.by ?? 1),
    );
  },
};
