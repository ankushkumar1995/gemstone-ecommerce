/**
 * /api/v1/admin/devotional  (admin, devotional:*)
 *   GET ?kind=&status=&q=                         → { items, counts }
 *   POST { ...item }                              → { item }   create
 *   PUT  { action: "reorder", ids }               → reorder
 *   PUT  { action: "import", items, dryRun? }     → { created, updated, failed }  bulk upsert by slug
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { devotionalService } from "@/modules/devotional";

export const dynamic = "force-dynamic";

const who = (s: { user: { name?: string; email?: string } }) => s.user.name || s.user.email || "Admin";

export async function GET(request: NextRequest) {
  const g = await requireAdmin("devotional:view");
  if (!g.ok) return jsonError(g.error);
  const sp = request.nextUrl.searchParams;
  const out = jsonOk(await devotionalService.adminList({ kind: sp.get("kind") ?? undefined, status: sp.get("status") ?? undefined, q: sp.get("q") ?? undefined }));
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}

export async function POST(request: NextRequest) {
  const g = await requireAdmin("devotional:create");
  if (!g.ok) return jsonError(g.error);
  const r = await devotionalService.create(await request.json().catch(() => null), who(g.value.session));
  return r.ok ? jsonOk({ item: r.value }, 201) : jsonError(r.error);
}

export async function PUT(request: NextRequest) {
  const g = await requireAdmin("devotional:edit");
  if (!g.ok) return jsonError(g.error);
  const body = (await request.json().catch(() => null)) as { action?: string; ids?: string[]; items?: unknown; dryRun?: boolean } | null;
  if (body?.action === "reorder" && Array.isArray(body.ids)) {
    const r = await devotionalService.reorder(body.ids.map(String), who(g.value.session));
    return r.ok ? jsonOk(r.value) : jsonError(r.error);
  }
  if (body?.action === "import") {
    const r = await devotionalService.importMany(body.items, who(g.value.session), body.dryRun === true);
    return r.ok ? jsonOk(r.value) : jsonError(r.error);
  }
  return jsonError(AppErrors.validation("Unknown action"));
}
