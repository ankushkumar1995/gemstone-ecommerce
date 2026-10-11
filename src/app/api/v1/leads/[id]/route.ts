/**
 * /api/v1/leads/:id
 *   PATCH → update a lead's status (admin)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { leadController } from "@/modules/leads";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return leadController.updateStatus(id, body);
  });
}
