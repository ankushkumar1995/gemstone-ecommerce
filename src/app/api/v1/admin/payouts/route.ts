/** GET /api/v1/admin/payouts?status=open|requested|approved|processing|paid|failed|rejected|cancelled|all&astrologerId=  (admin) → { payouts, provider } */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { astroSettingsService } from "@/modules/astro-settings";
import { earningsService, maybeRunEarningsJobs } from "@/modules/earnings";
import { razorpayxConfigured } from "@/core/razorpayx";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const g = await requireAdmin("payouts:view");
  if (!g.ok) return jsonError(g.error);
  maybeRunEarningsJobs();
  const sp = request.nextUrl.searchParams;
  const st = await astroSettingsService.get();
  const out = jsonOk({
    payouts: await earningsService.adminList({ status: sp.get("status") ?? "open", astrologerId: sp.get("astrologerId") ?? undefined }),
    provider: { mode: st.payouts.provider, razorpayxReady: razorpayxConfigured(), autoCreate: st.payouts.autoCreate, cycleWeekday: st.payouts.cycleWeekday },
  });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
