/**
 * /api/v1/products
 *   GET  → list all products
 *   POST → create a product (admin)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { productController } from "@/modules/products";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => productController.list());
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return productController.create(body);
  });
}
