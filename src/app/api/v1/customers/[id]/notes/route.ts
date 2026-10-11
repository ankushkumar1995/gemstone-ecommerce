/**
 * /api/v1/customers/:id/notes
 *   POST → append a note to the customer's activity timeline (admin)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { customerController } from "@/modules/customers";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return customerController.addNote(id, body);
  });
}
