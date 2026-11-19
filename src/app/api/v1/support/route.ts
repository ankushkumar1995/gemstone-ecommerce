/** GET /api/v1/support  (public) → { phone, whatsapp, email }  support channels from store settings (admin → Settings → General). */
import { jsonOk } from "@/core/http";
import { supportContact } from "@/modules/my-bookings";

export const dynamic = "force-dynamic";

export async function GET() {
  const c = await supportContact().catch(() => ({ phone: "", whatsapp: "", email: "" }));
  const out = jsonOk(c);
  out.headers.set("Cache-Control", "public, max-age=300");
  return out;
}
