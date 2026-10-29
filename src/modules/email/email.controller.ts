/** Email module — controller. */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import { createTemplateSchema, updateTemplateSchema, testEmailSchema } from "./email.schema";
import { emailService } from "./email.service";
import type { EmailTemplate, EmailLog } from "./email.types";

export const emailController = {
  async listTemplates(): Promise<NextResponse<ApiResponse<EmailTemplate[]>>> {
    return toResponse(await emailService.listTemplates());
  },
  async getTemplate(id: string): Promise<NextResponse<ApiResponse<EmailTemplate>>> {
    return toResponse(await emailService.getTemplate(id));
  },
  async createTemplate(body: unknown): Promise<NextResponse<ApiResponse<EmailTemplate>>> {
    const parsed = parse(createTemplateSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await emailService.createTemplate(parsed.value), 201);
  },
  async updateTemplate(id: string, body: unknown): Promise<NextResponse<ApiResponse<EmailTemplate>>> {
    const parsed = parse(updateTemplateSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await emailService.updateTemplate(id, parsed.value));
  },
  async removeTemplate(id: string): Promise<NextResponse<ApiResponse<{ id: string }>>> {
    return toResponse(await emailService.removeTemplate(id));
  },
  async listLogs(limit?: number): Promise<NextResponse<ApiResponse<EmailLog[]>>> {
    return toResponse(await emailService.listLogs(limit));
  },
  async test(body: unknown): Promise<NextResponse<ApiResponse<{ delivered: boolean; provider?: string; detail: string }>>> {
    const parsed = parse(testEmailSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await emailService.sendTest(parsed.value.to));
  },
};
