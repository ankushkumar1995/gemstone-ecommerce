/**
 * Blog domain — controller. Validates input and bridges HTTP ⇄ service.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import { createArticleSchema, updateArticleSchema } from "./article.schema";
import { articleService } from "./article.service";
import type { Article } from "@/types";

export const articleController = {
  async list(): Promise<NextResponse<ApiResponse<Article[]>>> {
    return toResponse(await articleService.list());
  },

  async listPublished(): Promise<NextResponse<ApiResponse<Article[]>>> {
    return toResponse(await articleService.listPublished());
  },

  async get(id: string): Promise<NextResponse<ApiResponse<Article>>> {
    return toResponse(await articleService.getById(id));
  },

  async getPublishedBySlug(slug: string): Promise<NextResponse<ApiResponse<Article>>> {
    return toResponse(await articleService.getPublishedBySlug(slug));
  },

  async related(slug: string): Promise<NextResponse<ApiResponse<Article[]>>> {
    return toResponse(await articleService.related(slug));
  },

  async create(body: unknown): Promise<NextResponse<ApiResponse<Article>>> {
    const parsed = parse(createArticleSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await articleService.create(parsed.value), 201);
  },

  async update(id: string, body: unknown): Promise<NextResponse<ApiResponse<Article>>> {
    const parsed = parse(updateArticleSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await articleService.update(id, parsed.value));
  },

  async remove(id: string): Promise<NextResponse<ApiResponse<{ id: string }>>> {
    return toResponse(await articleService.remove(id));
  },
};
