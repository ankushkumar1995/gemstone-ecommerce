/**
 * POST /api/v1/admin/devotional/upload  (admin, devotional:edit) — multipart: file, type=audio|image
 *   audio → stored as is (mp3 / m4a / aac / ogg / wav, up to 50 MB) → { url, key, bytes, contentType }
 *   image → upright, 1600 px, JPEG, no metadata                     → { url, key, bytes, contentType }
 * The editor reads the audio length in the browser and saves it with the item.
 */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { optimizePhoto } from "@/core/images";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { storageService } from "@/modules/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const AUDIO = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg", "audio/wav", "audio/x-wav", "audio/webm"];
const IMAGE = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("devotional:edit");
    if (!g.ok) return jsonError(g.error);
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const type = String(form?.get("type") ?? "");
    if (!(file instanceof File)) return jsonError(AppErrors.validation("Attach a file"));
    const base = (file.name || "file").replace(/\.[^.]+$/, "").slice(0, 60) || "file";
    if (type === "audio") {
      const ct = file.type || "audio/mpeg";
      if (!AUDIO.includes(ct)) return jsonError(AppErrors.validation("Use an MP3, M4A, AAC, OGG or WAV file"));
      if (file.size > 50 * 1024 * 1024) return jsonError(AppErrors.validation("Audio is too large (max 50 MB). Use MP3 at 128 kbps."));
      const ext = ct.includes("mpeg") || ct.includes("mp3") ? "mp3" : ct.includes("mp4") || ct.includes("m4a") ? "m4a" : ct.split("/")[1];
      const r = await storageService.upload({ folder: "devotional", fileName: `${base}.${ext}`, contentType: ct === "audio/mp3" ? "audio/mpeg" : ct, body: new Uint8Array(await file.arrayBuffer()) });
      return r.ok ? jsonOk({ url: r.value.url, key: r.value.key, bytes: r.value.size, contentType: r.value.contentType }, 201) : jsonError(r.error);
    }
    if (type === "image") {
      if (!IMAGE.includes(file.type)) return jsonError(AppErrors.validation("Use a JPG, PNG or WEBP image"));
      if (file.size > 15 * 1024 * 1024) return jsonError(AppErrors.validation("Image is too large (max 15 MB)"));
      const img = await optimizePhoto(new Uint8Array(await file.arrayBuffer()), { maxSide: 1600 });
      if (!img) return jsonError(AppErrors.validation("This image could not be read"));
      const r = await storageService.upload({ folder: "devotional", fileName: `${base}.jpg`, contentType: img.contentType, body: img.body });
      return r.ok ? jsonOk({ url: r.value.url, key: r.value.key, bytes: r.value.size, contentType: r.value.contentType }, 201) : jsonError(r.error);
    }
    return jsonError(AppErrors.validation("type must be audio or image"));
  }, request);
}
