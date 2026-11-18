/** GET /api/v1/agreements/current — the current partner agreement text (public, for applicants). Null if none is published. */
import { handle, jsonOk } from "@/core/http";
import { agreementService } from "@/modules/agreements";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => jsonOk(await agreementService.publicCurrent()), request);
}
