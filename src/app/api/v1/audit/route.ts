/**
 * /api/v1/audit?entity=&action=&q=&entityId=&before=&limit=  (admin, audit:view)
 *   GET → activity log, newest first. `before` = `at` of the last row shown (load more).
 */

import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { auditService } from "@/modules/audit";
import type { AuditAction, AuditEntity } from "@/modules/audit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("audit:view");
    if (!g.ok) return jsonError(g.error);
    const sp = new URL(request.url).searchParams;
    const before = sp.get("before");
    const out = toResponse(await auditService.list({
      entity: (sp.get("entity") as AuditEntity | null) || undefined,
      action: (sp.get("action") as AuditAction | null) || undefined,
      q: sp.get("q") || undefined,
      entityId: sp.get("entityId") || undefined,
      before: before && !Number.isNaN(Date.parse(before)) ? before : undefined,
      limit: Number(sp.get("limit")) || 200,
    }));
    out.headers.set("Cache-Control", "private, no-store");
    return out;
  });
}
