/**
 * /api/v1/payments?status=&method=&from=&to=&q=  (admin)
 *   GET → payment summary + transactions ledger (derived from orders/returns)
 */

import type { NextRequest } from "next/server";
import { handle, toResponse } from "@/core/http";
import { paymentService } from "@/modules/payments";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const sp = new URL(request.url).searchParams;
    return toResponse(
      await paymentService.report({
        status: sp.get("status") ?? undefined,
        method: sp.get("method") ?? undefined,
        from: sp.get("from") ?? undefined,
        to: sp.get("to") ?? undefined,
        q: sp.get("q") ?? undefined,
      })
    );
  });
}
