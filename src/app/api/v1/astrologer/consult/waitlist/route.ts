/**
 * /api/v1/astrologer/consult/waitlist  (approved astrologer)
 *   GET                              → { open, entries, enabled, maxSize }
 *   POST { action: "open" | "close" } accept a waitlist or not
 *   POST { action: "remove", id }    take someone out of the line
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { waitlistService } from "@/modules/consultations";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open") }),
  z.object({ action: z.literal("close") }),
  z.object({ action: z.literal("remove"), id: z.string().regex(/^[a-f0-9]{24}$/i) }),
]);

export async function GET() {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  const out = jsonOk(await waitlistService.forAstrologer(g.value.astrologer.id));
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}

export async function POST(request: NextRequest) {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  const p = parse(schema, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  const id = g.value.astrologer.id;
  if (p.value.action === "remove") {
    const r = await waitlistService.remove(id, p.value.id);
    if (!r.ok) return jsonError(r.error);
  } else {
    await waitlistService.setOpen(id, p.value.action === "open");
  }
  return jsonOk(await waitlistService.forAstrologer(id));
}
