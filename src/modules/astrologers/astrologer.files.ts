import "server-only";

/**
 * Private KYC document storage.
 *
 * Deliberately NOT part of the shared storage folders, so the admin Media
 * Library (which lists those folders) can never browse identity documents.
 *  • Keys: kyc/<astrologerId>/<type>-<random>.<ext>  (owner-scoped, no traversal)
 *  • Upload: server-proxied (size + type enforced here, not trusted to the browser)
 *  • Read: short-lived presigned GET (5 min) for admins with astrologers:edit
 *  • Objects are private by default (no ACL is sent: buckets with
 *    BucketOwnerEnforced reject ACL headers) and carry no-store headers.
 *
 * IMPORTANT (deployment): make sure the bucket policy does NOT grant public
 * read on the `kyc/` prefix. A bucket-wide public-read policy would override
 * the per-object ACL.
 */

import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { getS3, getBucket, isS3Configured } from "@/core/storage/s3";
import type { KycDocType } from "./astrologer.types";

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

/** Magic-number sniffing so a renamed executable can't pose as a PDF/JPEG. */
function sniff(buf: Uint8Array): string | null {
  const h = (n: number) => buf[n];
  if (h(0) === 0xff && h(1) === 0xd8 && h(2) === 0xff) return "image/jpeg";
  if (h(0) === 0x89 && h(1) === 0x50 && h(2) === 0x4e && h(3) === 0x47) return "image/png";
  if (h(0) === 0x25 && h(1) === 0x50 && h(2) === 0x44 && h(3) === 0x46) return "application/pdf";
  if (h(0) === 0x52 && h(1) === 0x49 && h(2) === 0x46 && h(3) === 0x46 && h(8) === 0x57 && h(9) === 0x45) return "image/webp";
  return null;
}

export const kycFiles = {
  async upload(astrologerId: string, type: KycDocType, fileName: string, contentType: string, body: Uint8Array): Promise<Result<{ fileKey: string; fileName: string }>> {
    if (!isS3Configured()) return fail(AppErrors.validation("File storage is not configured yet. Ask the admin to enable uploads."));
    if (!TYPES[contentType]) return fail(AppErrors.validation("Upload a JPG, PNG, WEBP or PDF file"));
    if (body.byteLength === 0) return fail(AppErrors.validation("The file is empty"));
    if (body.byteLength > MAX_BYTES) return fail(AppErrors.validation("File too large (max 8 MB)"));
    const real = sniff(body);
    if (!real || real !== contentType) return fail(AppErrors.validation("The file content does not match its type"));
    if (!/^[a-zA-Z0-9_]+$/.test(astrologerId)) return fail(AppErrors.validation("Invalid account"));
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(8))).map((b) => b.toString(16).padStart(2, "0")).join("");
    const fileKey = `kyc/${astrologerId}/${type}-${rand}.${TYPES[contentType]}`;
    try {
      await getS3().send(new PutObjectCommand({ Bucket: getBucket(), Key: fileKey, Body: body, ContentType: contentType, CacheControl: "private, no-store" }));
    } catch {
      return fail(AppErrors.internal("Upload failed. Please try again."));
    }
    return ok({ fileKey, fileName: fileName.slice(0, 160) || `${type}.${TYPES[contentType]}` });
  },

  /** 5-minute signed URL. Caller must have checked admin permission. */
  async signedUrl(astrologerId: string, fileKey: string): Promise<Result<{ url: string; expiresIn: number }>> {
    if (!isS3Configured()) return fail(AppErrors.validation("File storage is not configured"));
    if (!fileKey.startsWith(`kyc/${astrologerId}/`) || fileKey.includes("..")) return fail(AppErrors.forbidden("This file does not belong to the astrologer"));
    try {
      const url = await getSignedUrl(getS3(), new GetObjectCommand({ Bucket: getBucket(), Key: fileKey, ResponseCacheControl: "no-store" }), { expiresIn: 300 });
      return ok({ url, expiresIn: 300 });
    } catch {
      return fail(AppErrors.internal("Could not open the file"));
    }
  },
};
