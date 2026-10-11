/**
 * Services domain — controller.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import { createServiceSchema, updateServiceSchema } from "./service.schema";
import { serviceService } from "./service.service";
import type { AstroService } from "@/types";

export const serviceController = {
  async list(): Promise<NextResponse<ApiResponse<AstroService[]>>> {
    return toResponse(await serviceService.list());
  },
  async get(id: string): Promise<NextResponse<ApiResponse<AstroService>>> {
    return toResponse(await serviceService.getById(id));
  },
  async create(body: unknown): Promise<NextResponse<ApiResponse<AstroService>>> {
    const parsed = parse(createServiceSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await serviceService.create(parsed.value), 201);
  },
  async update(id: string, body: unknown): Promise<NextResponse<ApiResponse<AstroService>>> {
    const parsed = parse(updateServiceSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await serviceService.update(id, parsed.value));
  },
  async remove(id: string): Promise<NextResponse<ApiResponse<{ id: string }>>> {
    return toResponse(await serviceService.remove(id));
  },
};
