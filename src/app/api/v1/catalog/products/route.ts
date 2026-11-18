/**
 * GET /api/v1/catalog/products  (public; app + any API client)
 *   ?q=&category=&planet=&zodiac=&sort=popular|price_asc|price_desc|new|rating&ids=a,b
 *   → { products, categories, planets } active and switched on for the caller's channel.
 * Also nudges the expired-hold sweep (stock held by unpaid online orders).
 */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { channelOf } from "@/core/channels";
import { fetchOrderPayments, razorpayConfigured } from "@/core/razorpay";
import { catalogProducts, type ProductQuery } from "@/modules/catalog";
import { maybeSweepOrderHolds } from "@/modules/orders/order-checkout.service";

export const dynamic = "force-dynamic";
const SORTS = ["popular", "price_asc", "price_desc", "new", "rating"] as const;

export async function GET(request: NextRequest) {
  return handle(async () => {
    const rl = rateLimit(`catalog:products:${clientIp(request.headers)}`, { limit: 120, windowSeconds: 60 });
    if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many requests. Please try again in a minute."));
    if (razorpayConfigured()) maybeSweepOrderHolds(fetchOrderPayments);
    const sp = request.nextUrl.searchParams;
    const sort = sp.get("sort");
    const f: ProductQuery = {
      q: sp.get("q")?.slice(0, 80) || undefined,
      category: sp.get("category")?.slice(0, 80) || undefined,
      planet: sp.get("planet")?.slice(0, 40) || undefined,
      zodiac: sp.get("zodiac")?.slice(0, 20) || undefined,
      sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as ProductQuery["sort"]) : undefined,
      ids: sp.get("ids")?.split(",").map((x) => x.trim()).filter((x) => /^[A-Za-z0-9_-]{1,40}$/.test(x)).slice(0, 20),
    };
    const r = await catalogProducts.list(channelOf(request.headers), f);
    if (!r.ok) return jsonError(r.error);
    const res = jsonOk(r.value);
    res.headers.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    res.headers.set("Vary", "X-Client");
    return res;
  }, request);
}
