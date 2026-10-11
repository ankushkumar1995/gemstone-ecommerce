/**
 * Products domain — controller. Validates input and bridges HTTP ⇄ service.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import { createProductSchema, updateProductSchema } from "./product.schema";
import { productService } from "./product.service";
import type { Product } from "@/types";

export const productController = {
  async list(): Promise<NextResponse<ApiResponse<Product[]>>> {
    return toResponse(await productService.list());
  },

  async get(id: string): Promise<NextResponse<ApiResponse<Product>>> {
    return toResponse(await productService.getById(id));
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

  async remove(id: string): Promise<NextResponse<ApiResponse<{ id: string }>>> {
    return toResponse(await productService.remove(id));
  },
};
