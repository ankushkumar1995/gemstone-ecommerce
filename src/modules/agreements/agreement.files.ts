import "server-only";

/**
 * Signed agreement PDFs: private S3 archive + signed download links.
 *
 *  • Key: agreements/<astrologerId>/<certificateNo>.pdf (write-once per signature)
 *  • Private object, no-store headers. Never listed in the Media Library.
 *  • Copy links in emails carry an HMAC token (no login needed), so a partner
 *    whose account is suspended or closed can still download their contract.
 *    Tokens expire (default 30 days); admin can email a fresh one any time.
 *
 * IMPORTANT (deployment): the bucket policy must NOT grant public read on the
 * `agreements/` prefix.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/core/config/env";
import { logger } from "@/core/logger";
import { getS3, getBucket, isS3Configured } from "@/core/storage/s3";

const DEV_SECRET = "astrounkle-dev-only-agreement-copy-secret-change-me";
const secret = () => (env.ADMIN_SESSION_SECRET || DEV_SECRET) + "::agreement-copy";
export const COPY_LINK_DAYS = 30;

const keyFor = (astrologerId: string, certificateNo: string) =>
  `agreements/${astrologerId.replace(/[^a-zA-Z0-9_-]/g, "")}/${certificateNo.replace(/[^A-Z0-9-]/g, "")}.pdf`;

export const sha256Bytes = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/** Store the PDF. Returns the archive record, or null if storage is off / failed. */
export async function archivePdf(astrologerId: string, certificateNo: string, bytes: Uint8Array): Promise<{ key: string; sha256: string; bytes: number; storedAt: string } | null> {
  if (!isS3Configured()) return null;
  const key = keyFor(astrologerId, certificateNo);
  const sha256 = sha256Bytes(bytes);
  try {
    await getS3().send(new PutObjectCommand({
      Bucket: getBucket(), Key: key, Body: bytes, ContentType: "application/pdf",
      CacheControl: "private, no-store", ContentDisposition: "attachment",
      Metadata: { sha256, certificate: certificateNo },
    }));
    return { key, sha256, bytes: bytes.byteLength, storedAt: new Date().toISOString() };
  } catch (e) {
    logger.error("agreement pdf archive failed", { certificateNo, error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/** Read an archived PDF; null if missing, storage off, or the bytes do not match the stored hash. */
export async function readArchivedPdf(key: string, expectSha256: string): Promise<Uint8Array | null> {
  if (!isS3Configured() || !key.startsWith("agreements/") || key.includes("..")) return null;
  try {
    const r = await getS3().send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
    const bytes = r.Body ? await r.Body.transformToByteArray() : null;
    if (!bytes) return null;
    if (expectSha256 && sha256Bytes(bytes) !== expectSha256) {
      logger.error("agreement pdf hash mismatch", { key });
      return null;
    }
    return bytes;
  } catch (e) {
    logger.error("agreement pdf read failed", { key, error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/* ---------------- signed copy links ---------------- */

const sign = (id: string, exp: number) => createHmac("sha256", secret()).update(`${id}.${exp}`).digest("base64url");

export function copyToken(acceptanceId: string, days = COPY_LINK_DAYS): string {
  const exp = Math.floor(Date.now() / 1000) + days * 86400;
  return `${exp}.${sign(acceptanceId, exp)}`;
}

export function verifyCopyToken(acceptanceId: string, token: string): "ok" | "expired" | "invalid" {
  const [expRaw, mac] = token.split(".");
  const exp = Number(expRaw);
  if (!Number.isInteger(exp) || !mac) return "invalid";
  const a = Buffer.from(sign(acceptanceId, exp));
  const b = Buffer.from(mac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "invalid";
  return exp * 1000 < Date.now() ? "expired" : "ok";
}
