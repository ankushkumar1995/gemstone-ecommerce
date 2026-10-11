/**
 * Banners domain — controller.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import { createBannerSchema, updateBannerSchema } from "./banner.schema";
import { bannerService } from "./banner.service";
import type { Banner, BannerPlacement } from "./banner.types";

export const bannerController = {
  async list(): Promise<NextResponse<ApiResponse<Banner[]>>> {
    return toResponse(await bannerService.list());
  },
  async get(id: string): Promise<NextResponse<ApiResponse<Banner>>> {
    return toResponse(await bannerService.getById(id));
  },
  async forPlacement(placement: BannerPlacement): Promise<NextResponse<ApiResponse<Banner[]>>> {
    return toResponse(await bannerService.forPlacement(placement));
  },
  async create(body: unknown): Promise<NextResponse<ApiResponse<Banner>>> {
    const parsed = parse(createBannerSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await bannerService.create(parsed.value), 201);
  },
  async update(id: string, body: unknown): Promise<NextResponse<ApiResponse<Banner>>> {
    const parsed = parse(updateBannerSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await bannerService.update(id, parsed.value));
  },
  async remove(id: string): Promise<NextResponse<ApiResponse<{ id: string }>>> {
    return toResponse(await bannerService.remove(id));
  },
};
