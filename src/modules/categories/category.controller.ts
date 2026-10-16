/**
 * Categories domain — controller. Validates input and bridges HTTP ⇄ service.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import { parseListParams, type Paginated } from "@/core/query";
import { createCategorySchema, updateCategorySchema, reorderCategorySchema } from "./category.schema";
import { categoryService } from "./category.service";
import type { Category } from "@/types";

/** Sort keys a client is allowed to sort the category list by. */
const SORTABLE = ["order", "title", "slug", "createdAt", "updatedAt"];

export const categoryController = {
  async list(): Promise<NextResponse<ApiResponse<Category[]>>> {
    return toResponse(await categoryService.list());
  },

  async listPaginated(
    searchParams: URLSearchParams,
  ): Promise<NextResponse<ApiResponse<Paginated<Category>>>> {
    const params = parseListParams(searchParams, {
      defaultSort: { order: 1 },
      allowedSortKeys: SORTABLE,
    });
    return toResponse(await categoryService.listPaginated(params));
  },

  async get(id: string): Promise<NextResponse<ApiResponse<Category>>> {
    return toResponse(await categoryService.getById(id));
  },

  async getBySlug(slug: string): Promise<NextResponse<ApiResponse<Category>>> {
    return toResponse(await categoryService.getBySlug(slug));
  },

  async create(body: unknown): Promise<NextResponse<ApiResponse<Category>>> {
    const parsed = parse(createCategorySchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await categoryService.create(parsed.value), 201);
  },

  async update(id: string, body: unknown): Promise<NextResponse<ApiResponse<Category>>> {
    const parsed = parse(updateCategorySchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await categoryService.update(id, parsed.value));
  },

  async setStatus(id: string, status: "active" | "inactive"): Promise<NextResponse<ApiResponse<Category>>> {
    return toResponse(await categoryService.setStatus(id, status));
  },

  async reorder(body: unknown): Promise<NextResponse<ApiResponse<{ count: number }>>> {
    const parsed = parse(reorderCategorySchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await categoryService.reorder(parsed.value.ids));
  },

  async remove(id: string): Promise<NextResponse<ApiResponse<{ id: string }>>> {
    return toResponse(await categoryService.remove(id));
  },

  async restore(id: string): Promise<NextResponse<ApiResponse<Category>>> {
    return toResponse(await categoryService.restore(id));
  },
};
