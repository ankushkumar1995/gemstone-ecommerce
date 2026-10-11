/**
 * Returns (RMA) domain — controller.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import {
  createReturnSchema,
  updateReturnStatusSchema,
  addReturnNoteSchema,
} from "./return.schema";
import { returnService } from "./return.service";
import type { ReturnRequest } from "./return.types";

export const returnController = {
  async list(): Promise<NextResponse<ApiResponse<ReturnRequest[]>>> {
    return toResponse(await returnService.list());
  },
  async get(id: string): Promise<NextResponse<ApiResponse<ReturnRequest>>> {
    return toResponse(await returnService.getById(id));
  },
  async create(body: unknown): Promise<NextResponse<ApiResponse<ReturnRequest>>> {
    const parsed = parse(createReturnSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await returnService.create(parsed.value), 201);
  },
  async updateStatus(id: string, body: unknown): Promise<NextResponse<ApiResponse<ReturnRequest>>> {
    const parsed = parse(updateReturnStatusSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await returnService.updateStatus(id, parsed.value));
  },
  async addNote(id: string, body: unknown): Promise<NextResponse<ApiResponse<ReturnRequest>>> {
    const parsed = parse(addReturnNoteSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await returnService.addNote(id, parsed.value.note));
  },
};
