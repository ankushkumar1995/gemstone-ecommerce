/**
 * GET /api/v1/astrologers — public directory (approved + visible only).
 * Query: q, expertise, category, language, gender, online=1, channel, maxRate, sort, page, pageSize.
 * Used by the storefront and the mobile app.
 */
import type { NextRequest } from "next/server";
import { handle, toResponse } from "@/core/http";
import { astrologerService, type PublicListFilter } from "@/modules/astrologers";

export const dynamic = "force-dynamic";
const SORTS = ["recommended", "rating", "experience", "price_low", "price_high", "sessions"];
const CHANNELS = ["chat", "call", "video"];

export async function GET(request: NextRequest) {
  return handle(async () => {
    const p = request.nextUrl.searchParams;
    const str = (k: string) => p.get(k)?.trim().slice(0, 60) || undefined;
    const num = (k: string) => { const n = Number(p.get(k)); return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined; };
    const filter: PublicListFilter = {
      q: str("q"), expertise: str("expertise"), category: str("category"), language: str("language"), gender: str("gender"),
      online: p.get("online") === "1" || p.get("online") === "true",
      channel: CHANNELS.includes(p.get("channel") ?? "") ? (p.get("channel") as PublicListFilter["channel"]) : undefined,
      maxRate: num("maxRate"),
      sort: SORTS.includes(p.get("sort") ?? "") ? (p.get("sort") as PublicListFilter["sort"]) : undefined,
      page: num("page"), pageSize: num("pageSize"),
    };
    const res = toResponse(await astrologerService.listPublic(filter));
    res.headers.set("Cache-Control", "no-store");
    return res;
  }, request);
}