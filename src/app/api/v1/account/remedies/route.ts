/**
 * GET /api/v1/account/remedies  (signed-in customer)
 *   → { items }  what astrologers suggested in chats (last 90 days, newest first).
 *   No commission numbers are ever sent to the customer.
 */
import { jsonError, jsonOk } from "@/core/http";
import { requireCustomer } from "@/modules/customer-auth";
import { remedyService } from "@/modules/remedies";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  const items = (await remedyService.forCustomer(g.value.customerId)).map((s) => ({
    id: s.id, sessionId: s.sessionId, astrologerName: s.astrologerName, kind: s.kind, itemId: s.itemId, slug: s.slug,
    name: s.name, image: s.image, price: s.price, mrp: s.mrp, note: s.note, at: s.at, open: s.open,
  }));
  const out = jsonOk({ items });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
