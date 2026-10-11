/**
 * Leads domain — controller.
 *
 * Bridges HTTP ⇄ service. It validates untrusted input with zod, calls the
 * service, and returns a standard API response envelope. Route handlers stay
 * thin and just delegate here.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import { fail } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { createLeadSchema } from "./lead.schema";
import { leadService } from "./lead.service";
import type { Lead, LeadStatus } from "./lead.types";

const VALID_STATUSES: LeadStatus[] = ["new", "contacted", "converted", "closed"];

export const leadController = {
  /** POST /api/v1/leads — create a lead from form submission. */
  async create(body: unknown): Promise<NextResponse<ApiResponse<Lead>>> {
    const parsed = parse(createLeadSchema, body);
    if (!parsed.ok) return toResponse(parsed);

    const dto = parsed.value;
    const result = await leadService.create({
      ...dto,
      phone: dto.phone || undefined,
    });
    return toResponse(result, 201);
  },

  /** GET /api/v1/leads — list all leads (admin). */
  async list(): Promise<NextResponse<ApiResponse<Lead[]>>> {
    const result = await leadService.list();
    return toResponse(result);
  },

  /** PATCH /api/v1/leads/:id — update lead status (admin). */
  async updateStatus(
    id: string,
    body: unknown
  ): Promise<NextResponse<ApiResponse<Lead>>> {
    const status = (body as { status?: string } | null)?.status;
    if (!status || !VALID_STATUSES.includes(status as LeadStatus)) {
      return toResponse(
        fail<Lead>(AppErrors.validation("Invalid status", { allowed: VALID_STATUSES }))
      );
    }
    const result = await leadService.setStatus(id, status as LeadStatus);
    return toResponse(result);
  },
};
