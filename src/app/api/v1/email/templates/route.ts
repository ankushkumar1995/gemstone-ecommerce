/**
 * /api/v1/email/templates  (admin)
 *   GET  → list templates
 *   POST → create a template
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { emailController } from "@/modules/email";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => emailController.listTemplates());
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return emailController.createTemplate(body);
  });
}
