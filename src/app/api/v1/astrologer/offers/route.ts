/**
 * /api/v1/astrologer/offers  (approved astrologer)
 *   GET                    → { firstChat, freeMinutes, payPct, maxRate, rateOk }
 *   PUT { firstChat }      → same  take (or stop taking) first-chat offer customers
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { astroSettingsService } from "@/modules/astro-settings";
import { firstChatOffer } from "@/modules/consultations";

export const dynamic = "force-dynamic";

async function state(astrologerId: string, chatRate: number) {
  const st = await astroSettingsService.get();
  const p = await firstChatOffer.pref(astrologerId);
  return { firstChat: p.firstChat, freeMinutes: st.firstSessionFreeMinutes, payPct: st.firstChat.astrologerPayPct, maxRate: st.firstChat.maxRate, rateOk: st.firstChat.maxRate === 0 || chatRate <= st.firstChat.maxRate };
}

export async function GET() {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  const out = jsonOk(await state(g.value.astrologer.id, g.value.astrologer.rates?.chat ?? 0));
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}

export async function PUT(request: NextRequest) {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  const p = parse(z.object({ firstChat: z.boolean() }), await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  await firstChatOffer.setPref(g.value.astrologer.id, p.value.firstChat);
  return jsonOk(await state(g.value.astrologer.id, g.value.astrologer.rates?.chat ?? 0));
}
