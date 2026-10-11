/**
 * Categories domain — controller. Validates input and bridges HTTP ⇄ service.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import { createCategorySchema, updateCategorySchema } from "./category.schema";
import { categoryService } from "./category.service";
import type { Category } from "@/types";

export const categoryController = {
  async list(): Promise<NextResponse<ApiResponse<Category[]>>> {
    return toResponse(await categoryService.list());
  },

  async get(id: string): Promise<NextResponse<ApiResponse<Category>>> {
    return toResponse(await categoryService.getById(id));
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

  async remove(id: string): Promise<NextResponse<ApiResponse<{ id: string }>>> {
    return toResponse(await categoryService.remove(id));
  },
};
