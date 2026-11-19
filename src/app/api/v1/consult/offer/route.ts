/**
 * GET /api/v1/consult/offer  (public; signed-in customers get their own eligibility)
 *   → { enabled, freeMinutes, maxRate, eligible, optedOut }
 * First-chat offer: free minutes on a brand-new customer's first chat.
 */
import { jsonOk } from "@/core/http";
import { requireCustomer } from "@/modules/customer-auth";
import { firstChatOffer } from "@/modules/consultations";

export const dynamic = "force-dynamic";

export async function GET() {
  const c = await requireCustomer().catch(() => null);
  const out = jsonOk(await firstChatOffer.view(c?.ok ? c.value.customerId : null));
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
