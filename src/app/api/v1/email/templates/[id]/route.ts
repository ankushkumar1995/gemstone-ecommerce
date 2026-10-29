/**
 * /api/v1/email/templates/:id  (admin)
 *   GET    → single template
 *   PATCH  → update
 *   DELETE → remove (soft)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { emailController } from "@/modules/email";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    return emailController.getTemplate(id);
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return emailController.updateTemplate(id, body);
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    return emailController.removeTemplate(id);
  });
}
