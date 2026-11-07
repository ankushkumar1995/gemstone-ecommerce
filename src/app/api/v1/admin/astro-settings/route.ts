/** /api/v1/admin/astro-settings — GET / PATCH astrologer program settings. */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { astroSettingsService } from "@/modules/astro-settings";
import { auditService } from "@/modules/audit";
import { ok } from "@/core/result";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:view");
    if (!g.ok) return jsonError(g.error);
    void parse; void body;
    return toResponse(ok(await astroSettingsService.get()));
  }, request);
}

export async function PATCH(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("settings:edit");
    if (!g.ok) return jsonError(g.error);
    const input = await body(request);
    const res = await astroSettingsService.update(input);
    if (res.ok) await auditService.record({ action: "update", entity: "settings", entityId: "astro-settings", entityLabel: "Astrologer program", summary: "Updated " + Object.keys((input as object) ?? {}).join(", "), actor: g.value.session.user.name });
    return toResponse(res);
  }, request);
}