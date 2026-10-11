/**
 * /api/v1/categories
 *   GET  → list all categories (ordered)
 *   POST → create a category (admin)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { categoryController } from "@/modules/categories";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => categoryController.list());
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return categoryController.create(body);
  });
}
