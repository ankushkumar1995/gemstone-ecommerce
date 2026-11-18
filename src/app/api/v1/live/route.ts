/**
 * GET /api/v1/live?status=live|upcoming&tag=Career&lang=hindi  (public; signed-in customers get their follows ranked first)
 *   → { items, tags }  ranked: featured, followed, viewer's language, then most watched (live) / soonest (upcoming).
 */
import type { NextRequest } from "next/server";
import { jsonOk } from "@/core/http";
import { liveService, maybeSweepLives, LIVE_TAGS } from "@/modules/live";
import { requireCustomer } from "@/modules/customer-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  maybeSweepLives();
  const sp = request.nextUrl.searchParams;
  const status = sp.get("status") === "upcoming" ? "upcoming" : "live";
  const c = await requireCustomer().catch(() => null);
  const items = await liveService.list({
    status,
    tag: sp.get("tag"),
    lang: (sp.get("lang") ?? "").slice(0, 20) || null,
    customerId: c?.ok ? c.value.customerId : null,
  });
  const out = jsonOk({ items, tags: LIVE_TAGS });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
