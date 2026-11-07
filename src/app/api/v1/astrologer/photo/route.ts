/** POST /api/v1/astrologer/photo — multipart (field: file). Uploads a public profile photo and returns its URL. */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { limit } from "@/modules/astrologer-auth/http";
import { storageService } from "@/modules/storage";

export const dynamic = "force-dynamic";
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX = 4 * 1024 * 1024;

export async function POST(request: NextRequest) {
  return handle(async () => {
    const g = await requireAstrologer();
    if (!g.ok) return jsonError(g.error);
    const rl = limit(request, `astro:photo:${g.value.astrologer.id}`, 15, 60 * 60);
    if (rl) return jsonError(rl);
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return jsonError(AppErrors.validation("Attach a photo"));
    if (!TYPES.includes(file.type)) return jsonError(AppErrors.validation("Use a JPG, PNG or WEBP photo"));
    if (file.size > MAX) return jsonError(AppErrors.validation("Photo too large (max 4 MB)"));
    const res = await storageService.upload({ folder: "astrologers", fileName: `${g.value.astrologer.slug}.${file.type.split("/")[1]}`, contentType: file.type, body: new Uint8Array(await file.arrayBuffer()) });
    return toResponse(res.ok ? { ok: true as const, value: { url: res.value.url } } : res, 201);
  }, request);
}