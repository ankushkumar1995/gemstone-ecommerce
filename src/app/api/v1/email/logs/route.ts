/**
 * /api/v1/email/logs  (admin)
 *   GET → recent send attempts (?limit=100)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { emailController } from "@/modules/email";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(() => {
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? "100");
    return emailController.listLogs(Number.isFinite(limit) ? limit : 100);
  });
}
