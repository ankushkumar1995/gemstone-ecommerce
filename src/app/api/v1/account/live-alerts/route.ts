/**
 * GET /api/v1/account/live-alerts  (customer)
 *   → { live, followingIds, remindedIds }
 *   Lives on right now from astrologers I follow (alerts on) or that I asked to
 *   be reminded about. The app polls this for its in-app "is live" banner.
 */
import { jsonError, jsonOk } from "@/core/http";
import { requireCustomer } from "@/modules/customer-auth";
import { liveAlertsFor, maybeSweepLives } from "@/modules/live";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  maybeSweepLives();
  const out = jsonOk(await liveAlertsFor(g.value.customerId));
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
