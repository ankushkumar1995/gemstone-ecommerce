/**
 * /api/v1/banners  (admin)
 *   GET  → list all banners (ordered)
 *   POST → create a banner
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { bannerController } from "@/modules/banners";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => bannerController.list());
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return bannerController.create(body);
  });
}
