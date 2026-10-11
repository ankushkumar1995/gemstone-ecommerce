/**
 * /api/v1/pages  (admin)
 *   GET  → list all CMS pages
 *   POST → create a page
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { pageController } from "@/modules/pages";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => pageController.list());
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return pageController.create(body);
  });
}
