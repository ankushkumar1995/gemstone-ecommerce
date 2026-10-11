/**
 * /api/v1/blog/:slug/related  (public storefront)
 *   GET → up to 3 related PUBLISHED articles
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { articleController } from "@/modules/blog";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  return handle(async () => {
    const { slug } = await params;
    return articleController.related(slug);
  });
}
