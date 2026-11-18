/** GET /api/v1/consult/sessions/active  (customer) → { session | null }  resume a chat after the app was closed. */
import { jsonError, jsonOk } from "@/core/http";
import { requireCustomer } from "@/modules/customer-auth";
import { consultService } from "@/modules/consultations";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  const r = await consultService.active(g.value.customerId);
  if (!r.ok) return jsonError(r.error);
  const out = jsonOk({ session: r.value });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
