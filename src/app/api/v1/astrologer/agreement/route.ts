/** GET /api/v1/astrologer/agreement — current version, my signature, gate and OTP state. */
import { handle, jsonError, jsonOk } from "@/core/http";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { agreementService } from "@/modules/agreements";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const g = await requireAstrologer();
    if (!g.ok) return jsonError(g.error);
    return jsonOk(await agreementService.state(g.value.astrologer));
  }, request);
}
