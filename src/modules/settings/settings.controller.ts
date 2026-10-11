/**
 * Settings domain — controller. Bridges HTTP ⇄ service for the single
 * settings document.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import { updateSettingsSchema } from "./settings.schema";
import { settingsService } from "./settings.service";
import type { StoreSettings } from "./settings.types";

export const settingsController = {
  async get(): Promise<NextResponse<ApiResponse<StoreSettings>>> {
    return toResponse(await settingsService.get());
  },

  async update(body: unknown): Promise<NextResponse<ApiResponse<StoreSettings>>> {
    const parsed = parse(updateSettingsSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await settingsService.update(parsed.value));
  },
};
