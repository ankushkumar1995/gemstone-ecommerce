/**
 * /api/v1/products/slug/:slug
 *   GET → single product by slug (storefront lookup, cached)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { productController } from "@/modules/products";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  return handle(async () => {
    const { slug } = await params;
    return productController.getBySlug(slug);
  }, request);
}
