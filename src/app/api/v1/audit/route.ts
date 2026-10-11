/**
 * /api/v1/audit?entity=&action=&q=  (admin)
 *   GET → panel-wide activity log, newest first, with light filters
 */

import type { NextRequest } from "next/server";
import { handle, toResponse } from "@/core/http";
import { auditService } from "@/modules/audit";
import type { AuditAction, AuditEntity } from "@/modules/audit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const sp = new URL(request.url).searchParams;
    const entity = (sp.get("entity") as AuditEntity | null) ?? undefined;
    const action = (sp.get("action") as AuditAction | null) ?? undefined;
    const q = sp.get("q") ?? undefined;
    return toResponse(await auditService.list({ entity, action, q }));
  });
}
