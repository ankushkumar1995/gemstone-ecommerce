/**
 * Reviews domain — controller.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import { createReviewSchema, updateReviewSchema } from "./review.schema";
import { reviewService } from "./review.service";
import type { Review } from "./review.types";

export const reviewController = {
  async list(): Promise<NextResponse<ApiResponse<Review[]>>> {
    return toResponse(await reviewService.list());
  },
  async get(id: string): Promise<NextResponse<ApiResponse<Review>>> {
    return toResponse(await reviewService.getById(id));
  },
  async create(body: unknown): Promise<NextResponse<ApiResponse<Review>>> {
    const parsed = parse(createReviewSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await reviewService.create(parsed.value), 201);
  },
  async update(id: string, body: unknown): Promise<NextResponse<ApiResponse<Review>>> {
    const parsed = parse(updateReviewSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await reviewService.update(id, parsed.value));
  },
  async remove(id: string): Promise<NextResponse<ApiResponse<{ id: string }>>> {
    return toResponse(await reviewService.remove(id));
  },
};
