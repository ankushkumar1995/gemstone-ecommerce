/**
 * /api/v1/articles  (admin)
 *   GET  → list ALL articles (draft + published)
 *   POST → create an article
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { articleController } from "@/modules/blog";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => articleController.list());
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return articleController.create(body);
  });
}
