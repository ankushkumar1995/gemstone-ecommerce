/**
 * /api/v1/blog  (public storefront)
 *   GET → list PUBLISHED articles only
 */

import { handle } from "@/core/http";
import { articleController } from "@/modules/blog";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => articleController.listPublished());
}
