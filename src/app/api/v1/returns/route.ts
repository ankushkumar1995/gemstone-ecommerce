/**
 * /api/v1/returns
 *   GET  → list all returns
 *   POST → create a return (admin / customer)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { returnController } from "@/modules/returns";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => returnController.list());
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return returnController.create(body);
  });
}
