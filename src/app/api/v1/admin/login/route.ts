import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { adminAuthController } from "@/modules/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return adminAuthController.login(body);
  });
}
