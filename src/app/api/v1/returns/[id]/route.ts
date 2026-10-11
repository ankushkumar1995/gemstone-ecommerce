/**
 * /api/v1/returns/:id  → GET single return
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { returnController } from "@/modules/returns";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return returnController.get(id);
  });
}
