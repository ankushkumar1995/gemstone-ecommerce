/**
 * Popups domain — controller. Maps validated input to service calls and
 * service Results to HTTP responses.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import {
  createPopupSchema,
  updatePopupSchema,
  popupSubmissionSchema,
  popupEventSchema,
} from "./popup.schema";
import { popupService } from "./popup.service";
import type { Popup, PublicPopup } from "./popup.types";

export const popupController = {
  async list(): Promise<NextResponse<ApiResponse<Popup[]>>> {
    return toResponse(await popupService.list());
  },
  async get(id: string): Promise<NextResponse<ApiResponse<Popup>>> {
    return toResponse(await popupService.getById(id));
  },
  async live(): Promise<NextResponse<ApiResponse<PublicPopup[]>>> {
    return toResponse(await popupService.liveForPublic());
  },
  async create(body: unknown): Promise<NextResponse<ApiResponse<Popup>>> {
    const parsed = parse(createPopupSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await popupService.create(parsed.value), 201);
  },
  async update(id: string, body: unknown): Promise<NextResponse<ApiResponse<Popup>>> {
    const parsed = parse(updatePopupSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await popupService.update(id, parsed.value));
  },
  async remove(id: string): Promise<NextResponse<ApiResponse<{ id: string }>>> {
    return toResponse(await popupService.remove(id));
  },
  async event(body: unknown): Promise<NextResponse<ApiResponse<{ recorded: boolean }>>> {
    const parsed = parse(popupEventSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await popupService.recordEvent(parsed.value.popupId, parsed.value.event));
  },
  async submit(body: unknown): Promise<NextResponse<ApiResponse<{ ok: true }>>> {
    const parsed = parse(popupSubmissionSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await popupService.submit(parsed.value), 201);
  },
};
