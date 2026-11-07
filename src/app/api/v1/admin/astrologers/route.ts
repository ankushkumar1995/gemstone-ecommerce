/** /api/v1/admin/astrologers — GET list (?status=a,b&q=) · POST invite (returns one-time temp password). */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { astrologerService, inviteSchema, ASTROLOGER_STATUSES, type AstrologerStatus } from "@/modules/astrologers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:view");
    if (!g.ok) return jsonError(g.error);
    const p = request.nextUrl.searchParams;
    const status = (p.get("status") ?? "").split(",").filter((s): s is AstrologerStatus => ASTROLOGER_STATUSES.includes(s as AstrologerStatus));
    return toResponse(await astrologerService.listAdmin({ status: status.length ? status : undefined, q: p.get("q")?.slice(0, 80) || undefined }));
  }, request);
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:create");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(inviteSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await astrologerService.invite(parsed.value, { name: g.value.session.user.name, kind: "admin" }), 201);
  }, request);
}