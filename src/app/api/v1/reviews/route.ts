/**
 * /api/v1/reviews
 *   GET  → list all reviews (admin)
 *   POST → create a review (customer; starts pending)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { reviewController } from "@/modules/reviews";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => reviewController.list());
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return reviewController.create(body);
  });
}
