/**
 * /api/v1/collections
 *   GET  → list all collections
 *   POST → create a collection (admin)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { collectionController } from "@/modules/collections";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => collectionController.list());
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return collectionController.create(body);
  });
}
