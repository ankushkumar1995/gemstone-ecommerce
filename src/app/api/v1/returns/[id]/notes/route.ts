/**
 * /api/v1/returns/:id/notes  → POST add a note to a return (admin)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { returnController } from "@/modules/returns";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return returnController.addNote(id, body);
  });
}
