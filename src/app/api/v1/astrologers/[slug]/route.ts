/** GET /api/v1/astrologers/:slug — public profile. */
import type { NextRequest } from "next/server";
import { handle, toResponse } from "@/core/http";
import { astrologerService } from "@/modules/astrologers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await params;
    return toResponse(await astrologerService.getPublic(slug.slice(0, 120)));
  }, request);
}