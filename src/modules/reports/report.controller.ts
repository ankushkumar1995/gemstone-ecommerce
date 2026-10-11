/**
 * Reports domain — controller.
 */

import type { NextResponse } from "next/server";
import { toResponse, type ApiResponse } from "@/core/http";
import { reportService } from "./report.service";
import type { SalesReport } from "./report.types";

export const reportController = {
  async sales(from?: string, to?: string): Promise<NextResponse<ApiResponse<SalesReport>>> {
    return toResponse(await reportService.sales(from, to));
  },
};
