/**
 * Pages (CMS) domain — controller.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import { createPageSchema, updatePageSchema } from "./page.schema";
import { pageService } from "./page.service";
import type { CmsPage } from "./page.types";

export const pageController = {
  async list(): Promise<NextResponse<ApiResponse<CmsPage[]>>> {
    return toResponse(await pageService.list());
  },
  async get(id: string): Promise<NextResponse<ApiResponse<CmsPage>>> {
    return toResponse(await pageService.getById(id));
  },
  async create(body: unknown): Promise<NextResponse<ApiResponse<CmsPage>>> {
    const parsed = parse(createPageSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await pageService.create(parsed.value), 201);
  },
  async update(id: string, body: unknown): Promise<NextResponse<ApiResponse<CmsPage>>> {
    const parsed = parse(updatePageSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await pageService.update(id, parsed.value));
  },
  async remove(id: string): Promise<NextResponse<ApiResponse<{ id: string }>>> {
    return toResponse(await pageService.remove(id));
  },
};
