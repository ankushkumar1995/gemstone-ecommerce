/**
 * /api/v1/services  (admin)
 *   GET  → list all services (ordered, incl. inactive)
 *   POST → create a service
 * Admin session + services permission required. The storefront reads
 * services server-side through serviceService, not this route.
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { serviceController } from "@/modules/services";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("services:view");
    if (!g.ok) return jsonError(g.error);
    return serviceController.list();
  }, request);
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("services:create");
    if (!g.ok) return jsonError(g.error);
    const body = await request.json().catch(() => null);
    return serviceController.create(body);
  }, request);
}
