/**
 * /api/v1/admin/devotional/:id  (admin)
 *   GET              → { item }
 *   PATCH { ... }    → { item }  edit (any fields; status to publish / unpublish)
 *   DELETE           → { ok }    soft delete (hidden from the app)
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { devotionalService } from "@/modules/devotional";

export const dynamic = "force-dynamic";

const who = (s: { user: { name?: string; email?: string } }) => s.user.name || s.user.email || "Admin";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin("devotional:view");
  if (!g.ok) return jsonError(g.error);
  const { id } = await params;
  const r = await devotionalService.adminGet(id);
  return r.ok ? jsonOk({ item: r.value }) : jsonError(r.error);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin("devotional:edit");
  if (!g.ok) return jsonError(g.error);
  const { id } = await params;
  const r = await devotionalService.update(id, await request.json().catch(() => ({})), who(g.value.session));
  return r.ok ? jsonOk({ item: r.value }) : jsonError(r.error);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin("devotional:delete");
  if (!g.ok) return jsonError(g.error);
  const { id } = await params;
  const r = await devotionalService.remove(id, who(g.value.session));
  return r.ok ? jsonOk(r.value) : jsonError(r.error);
}
