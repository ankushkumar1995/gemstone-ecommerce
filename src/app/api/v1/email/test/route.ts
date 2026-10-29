/**
 * /api/v1/email/test  (admin)
 *   POST → send a test email { to } through the configured providers.
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { emailController } from "@/modules/email";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return emailController.test(body);
  });
}
