/**
 * GET /api/v1/devotional?kind=mantra|aarti|chalisa|stotra|katha|bhajan|library&deity=&q=  (public)
 *   → { items, today }  published items (light rows), plus today's mantra
 */
import type { NextRequest } from "next/server";
import { jsonOk } from "@/core/http";
import { devotionalService } from "@/modules/devotional";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const [items, today] = await Promise.all([
    devotionalService.list({ kind: sp.get("kind") ?? undefined, deity: sp.get("deity") ?? undefined, q: (sp.get("q") ?? "").slice(0, 60) || undefined }),
    devotionalService.today(),
  ]);
  const out = jsonOk({ items, today });
  out.headers.set("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
  return out;
}
