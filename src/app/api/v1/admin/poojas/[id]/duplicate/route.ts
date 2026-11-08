/** POST /api/v1/admin/poojas/:id/duplicate — copy as a new draft. */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { poojaService } from "@/modules/poojas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const g = await requireAdmin("poojas:create");
    if (!g.ok) return jsonError(g.error);
    return toResponse(await poojaService.duplicate((await params).id, { name: g.value.session.user.name }), 201);
  }, request);
}
