/**
 * Customers domain — controller. Validates input and bridges HTTP ⇄ service.
 */

import type { NextResponse } from "next/server";
import { z } from "zod";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import { createCustomerSchema, updateCustomerSchema } from "./customer.schema";
import { customerService } from "./customer.service";
import type { Customer } from "./customer.types";

const noteSchema = z.object({ note: z.string().trim().min(1, "Note cannot be empty").max(1000) });

export const customerController = {
  async list(): Promise<NextResponse<ApiResponse<Customer[]>>> {
    return toResponse(await customerService.list());
  },

  async get(id: string): Promise<NextResponse<ApiResponse<Customer>>> {
    return toResponse(await customerService.getById(id));
  },

  async create(body: unknown): Promise<NextResponse<ApiResponse<Customer>>> {
    const parsed = parse(createCustomerSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await customerService.create(parsed.value), 201);
  },

  async update(id: string, body: unknown): Promise<NextResponse<ApiResponse<Customer>>> {
    const parsed = parse(updateCustomerSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await customerService.update(id, parsed.value));
  },

  async addNote(id: string, body: unknown): Promise<NextResponse<ApiResponse<Customer>>> {
    const parsed = parse(noteSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await customerService.addNote(id, parsed.value.note));
  },

  async remove(id: string): Promise<NextResponse<ApiResponse<{ id: string }>>> {
    return toResponse(await customerService.remove(id));
  },
};
