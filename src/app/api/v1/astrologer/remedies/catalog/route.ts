/**
 * GET /api/v1/astrologer/remedies/catalog?q=&kind=product|pooja  (approved astrologer)
 *   → { rules, items }  shop products and poojas that can be suggested in a chat,
 *   with the commission on one unit at today's price.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { remedyService } from "@/modules/remedies";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  const sp = request.nextUrl.searchParams;
  const k = sp.get("kind");
  const out = jsonOk(await remedyService.catalog({ q: (sp.get("q") ?? "").slice(0, 60), kind: k === "product" || k === "pooja" ? k : undefined }));
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
