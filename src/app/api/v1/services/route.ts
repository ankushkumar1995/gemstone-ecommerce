/**
 * /api/v1/services  (admin)
 *   GET  → list all services (ordered)
 *   POST → create a service
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { serviceController } from "@/modules/services";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => serviceController.list());
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return serviceController.create(body);
  });
}
