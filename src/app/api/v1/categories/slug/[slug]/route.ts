/**
 * /api/v1/categories/slug/:slug
 *   GET → single category by slug (storefront lookup, cached)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { categoryController } from "@/modules/categories";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  return handle(async () => {
    const { slug } = await params;
    return categoryController.getBySlug(slug);
  }, request);
}
