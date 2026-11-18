/**
 * POST /api/v1/astrologer/photo — multipart (field: file). Uploads a public profile photo and returns its URL.
 *
 * Every photo is made upright, shrunk to 1600 px on the long side (sharp on a full-screen phone), saved as
 * JPEG and stripped of metadata (GPS, camera) before it goes to S3, so a 5 MB
 * phone photo becomes about 150 to 250 KB and loads fast in the app.
 */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { optimizePhoto } from "@/core/images";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { limit } from "@/modules/astrologer-auth/http";
import { storageService } from "@/modules/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Raw upload limit (before shrinking). Phone photos are often 5 to 12 MB. */
const MAX = 15 * 1024 * 1024;

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
    if (file.size > MAX) return jsonError(AppErrors.validation("Photo too large (max 15 MB)"));
    const img = await optimizePhoto(new Uint8Array(await file.arrayBuffer()), { maxSide: 1600 });
    if (!img) return jsonError(AppErrors.validation("This photo could not be read. Try another JPG or PNG."));
    if (img.width < 200 || img.height < 200) return jsonError(AppErrors.validation("Photo is too small. Use one at least 200 × 200 pixels."));
    const res = await storageService.upload({ folder: "astrologers", fileName: `${g.value.astrologer.slug}.jpg`, contentType: img.contentType, body: img.body });
    return toResponse(res.ok ? { ok: true as const, value: { url: res.value.url, width: img.width, height: img.height, bytes: img.bytes } } : res, 201);
  }, request);
}
