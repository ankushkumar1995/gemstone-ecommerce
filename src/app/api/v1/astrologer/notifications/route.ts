/**
 * /api/v1/astrologer/notifications
 *   GET  ?before=<iso>&unread=1 → { items, unread, nextBefore }
 *   POST { ids?: string[], all?: true } → mark read → { updated, unread }
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { body } from "@/modules/astrologer-auth/http";
import { noticeService } from "@/modules/partner-notices";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const g = await requireAstrologer({ allowPasswordChange: true });
    if (!g.ok) return jsonError(g.error);
    const sp = request.nextUrl.searchParams;
    const before = sp.get("before") && !Number.isNaN(Date.parse(sp.get("before")!)) ? sp.get("before")! : undefined;
    return jsonOk(await noticeService.list(g.value.astrologer.id, before, sp.get("unread") === "1"));
  }, request);
}

const markSchema = z.object({ ids: z.array(z.string().trim().min(1).max(60)).max(200).optional(), all: z.literal(true).optional() })
  .refine((v) => v.all || (v.ids && v.ids.length), { message: "Send ids or all" });

export async function POST(request: NextRequest) {
  return handle(async () => {
    const g = await requireAstrologer({ allowPasswordChange: true });
    if (!g.ok) return jsonError(g.error);
    const p = parse(markSchema, await body(request));
    if (!p.ok) return jsonError(p.error);
    return jsonOk(await noticeService.markRead(g.value.astrologer.id, p.value.all ? "all" : p.value.ids!));
  }, request);
}
