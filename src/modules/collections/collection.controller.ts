/**
 * Collections domain — controller. Validates input and bridges HTTP ⇄ service.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import { createCollectionSchema, updateCollectionSchema } from "./collection.schema";
import { collectionService } from "./collection.service";
import type { Collection } from "@/types";

export const collectionController = {
  async list(): Promise<NextResponse<ApiResponse<Collection[]>>> {
    return toResponse(await collectionService.list());
  },

  async get(id: string): Promise<NextResponse<ApiResponse<Collection>>> {
    return toResponse(await collectionService.getById(id));
  },

  async create(body: unknown): Promise<NextResponse<ApiResponse<Collection>>> {
    const parsed = parse(createCollectionSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await collectionService.create(parsed.value), 201);
  },

  async update(id: string, body: unknown): Promise<NextResponse<ApiResponse<Collection>>> {
    const parsed = parse(updateCollectionSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await collectionService.update(id, parsed.value));
  },

  async remove(id: string): Promise<NextResponse<ApiResponse<{ id: string }>>> {
    return toResponse(await collectionService.remove(id));
  },
};
