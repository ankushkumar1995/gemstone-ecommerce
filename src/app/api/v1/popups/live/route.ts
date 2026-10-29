/**
 * /api/v1/popups/live  (public)
 *   GET → live popups (enabled + within schedule), public shape only.
 *
 * The (site) layout fetches these server-side, but this endpoint also exists
 * so client code can refetch if ever needed.
 */

import { handle } from "@/core/http";
import { popupController } from "@/modules/popups";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => popupController.live());
}
