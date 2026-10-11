/**
 * /api/v1/reports/sales?from=ISO&to=ISO  (admin)
 *   GET → aggregated sales report for the date range
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { reportController } from "@/modules/reports";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(() => {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    return reportController.sales(from, to);
  });
}
