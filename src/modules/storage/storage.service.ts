import "server-only";

/**
 * Storage (S3) domain — service. The single, reusable upload layer for the
 * whole admin: images, videos, documents — organised into folders, with every
 * action the admin UI needs. All callers go through here (never the raw S3
 * client), and everything is admin-only (the API routes enforce the session).
 *
 * Actions: upload (server proxy), presignUpload (browser→S3 direct),
 * presignDownload, list (folder-aware), delete, deleteMany, exists, copy, move.
 */

import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { getS3, getBucket, publicUrl, isS3Configured } from "@/core/storage/s3";
import { STORAGE_FOLDERS } from "./storage.types";
import type {
  StorageFolder,
  StorageListing,
  StorageObject,
  UploadResult,
  PresignedUpload,
} from "./storage.types";

/* ---------------- limits & allow-lists ---------------- */

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB
const MAX_OTHER_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  doc: ["application/pdf"],
};

function kindFor(contentType: string): "image" | "video" | "doc" | null {
  if (ALLOWED.image.includes(contentType)) return "image";
  if (ALLOWED.video.includes(contentType)) return "video";
  if (ALLOWED.doc.includes(contentType)) return "doc";
  return null;
}

function maxBytesFor(kind: "image" | "video" | "doc"): number {
  if (kind === "video") return MAX_VIDEO_BYTES;
  if (kind === "doc") return MAX_OTHER_BYTES;
  return MAX_IMAGE_BYTES;
}

/* ---------------- key helpers ---------------- */

function isValidFolder(folder: string): folder is StorageFolder {
  return (STORAGE_FOLDERS as readonly string[]).includes(folder);
}

/** Make a safe file name: lowercase, strip unsafe chars, keep extension. */
function safeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "file";
  const ext = (dot > 0 ? name.slice(dot + 1) : "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return ext ? `${base}.${ext}` : base;
}

/** A collision-resistant key: folder/<rand>-<name>. */
function buildKey(folder: StorageFolder, name: string): string {
  const rand = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${folder}/${rand}-${safeName(name)}`;
}

/** Guard a caller-supplied key stays inside an allowed folder (no traversal). */
function assertSafeKey(key: string): Result<true> {
  if (!key || key.includes("..") || key.startsWith("/")) {
    return fail(AppErrors.validation("Invalid object key"));
  }
  const folder = key.split("/")[0];
  if (!isValidFolder(folder)) {
    return fail(AppErrors.validation("Key must live under an allowed folder"));
  }
  return ok(true);
}

function toObject(key: string, size: number, contentType?: string, lastModified?: Date): StorageObject {
  const slash = key.indexOf("/");
  return {
    key,
    url: publicUrl(key),
    size,
    contentType,
    lastModified: lastModified?.toISOString(),
    folder: slash > 0 ? key.slice(0, slash) : "",
    name: slash > 0 ? key.slice(slash + 1) : key,
  };
}

function ensureConfigured(): Result<true> {
  if (!isS3Configured()) {
    return fail(AppErrors.internal("Storage is not configured. Add AWS keys, region and bucket to .env"));
  }
  return ok(true);
}

/* ---------------- the service ---------------- */

export const storageService = {
  isConfigured: isS3Configured,
  folders: STORAGE_FOLDERS,

  /** Server-proxied upload (admin sends the file bytes, we put them in S3). */
  async upload(params: {
    folder: string;
    fileName: string;
    contentType: string;
    body: Buffer | Uint8Array;
  }): Promise<Result<UploadResult>> {
    const cfg = ensureConfigured();
    if (!cfg.ok) return cfg;

    if (!isValidFolder(params.folder)) {
      return fail(AppErrors.validation(`Unknown folder "${params.folder}"`));
    }
    const kind = kindFor(params.contentType);
    if (!kind) {
      return fail(AppErrors.validation(`File type "${params.contentType}" is not allowed`));
    }
    const size = params.body.byteLength;
    if (size > maxBytesFor(kind)) {
      return fail(AppErrors.validation(`File too large for a ${kind} (max ${Math.round(maxBytesFor(kind) / 1048576)} MB)`));
    }

    const key = buildKey(params.folder, params.fileName);
    try {
      await getS3().send(
        new PutObjectCommand({
          Bucket: getBucket(),
          Key: key,
          Body: params.body,
          ContentType: params.contentType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      return ok({ key, url: publicUrl(key), size, contentType: params.contentType });
    } catch (e) {
      return fail(AppErrors.internal(e instanceof Error ? e.message : "Upload failed"));
    }
  },

  /** Presigned PUT URL for large/direct browser→S3 uploads (e.g. videos). */
  async presignUpload(params: {
    folder: string;
    fileName: string;
    contentType: string;
    expiresIn?: number;
  }): Promise<Result<PresignedUpload>> {
    const cfg = ensureConfigured();
    if (!cfg.ok) return cfg;

    if (!isValidFolder(params.folder)) {
      return fail(AppErrors.validation(`Unknown folder "${params.folder}"`));
    }
    if (!kindFor(params.contentType)) {
      return fail(AppErrors.validation(`File type "${params.contentType}" is not allowed`));
    }

    const key = buildKey(params.folder, params.fileName);
    const expiresIn = params.expiresIn ?? 300; // 5 min
    try {
      const url = await getSignedUrl(
        getS3(),
        new PutObjectCommand({
          Bucket: getBucket(),
          Key: key,
          ContentType: params.contentType,
        }),
        { expiresIn },
      );
      return ok({
        key,
        url,
        publicUrl: publicUrl(key),
        expiresIn,
        headers: { "Content-Type": params.contentType },
      });
    } catch (e) {
      return fail(AppErrors.internal(e instanceof Error ? e.message : "Could not create upload URL"));
    }
  },

  /** Presigned GET URL (for private objects / temporary access). */
  async presignDownload(key: string, expiresIn = 300): Promise<Result<{ url: string; expiresIn: number }>> {
    const cfg = ensureConfigured();
    if (!cfg.ok) return cfg;
    const safe = assertSafeKey(key);
    if (!safe.ok) return safe;
    try {
      const url = await getSignedUrl(
        getS3(),
        new GetObjectCommand({ Bucket: getBucket(), Key: key }),
        { expiresIn },
      );
      return ok({ url, expiresIn });
    } catch (e) {
      return fail(AppErrors.internal(e instanceof Error ? e.message : "Could not create download URL"));
    }
  },

  /** List objects in a folder (and immediate sub-folders). */
  async list(folder = "", limit = 200): Promise<Result<StorageListing>> {
    const cfg = ensureConfigured();
    if (!cfg.ok) return cfg;
    if (folder && !isValidFolder(folder)) {
      return fail(AppErrors.validation(`Unknown folder "${folder}"`));
    }
    const prefix = folder ? `${folder}/` : "";
    try {
      const res = await getS3().send(
        new ListObjectsV2Command({
          Bucket: getBucket(),
          Prefix: prefix,
          Delimiter: "/",
          MaxKeys: limit,
        }),
      );
      const objects: StorageObject[] = (res.Contents ?? [])
        .filter((o) => o.Key && o.Key !== prefix)
        .map((o) => toObject(o.Key!, o.Size ?? 0, undefined, o.LastModified))
        .sort((a, b) => (b.lastModified ?? "").localeCompare(a.lastModified ?? ""));
      const subfolders = (res.CommonPrefixes ?? [])
        .map((p) => p.Prefix?.replace(/\/$/, "") ?? "")
        .filter(Boolean);
      return ok({ folder, objects, subfolders });
    } catch (e) {
      return fail(AppErrors.internal(e instanceof Error ? e.message : "Could not list objects"));
    }
  },

  /** Does an object exist? */
  async exists(key: string): Promise<Result<boolean>> {
    const cfg = ensureConfigured();
    if (!cfg.ok) return cfg;
    const safe = assertSafeKey(key);
    if (!safe.ok) return safe;
    try {
      await getS3().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
      return ok(true);
    } catch {
      return ok(false);
    }
  },

  /** Delete one object. */
  async remove(key: string): Promise<Result<{ key: string }>> {
    const cfg = ensureConfigured();
    if (!cfg.ok) return cfg;
    const safe = assertSafeKey(key);
    if (!safe.ok) return safe;
    try {
      await getS3().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
      return ok({ key });
    } catch (e) {
      return fail(AppErrors.internal(e instanceof Error ? e.message : "Delete failed"));
    }
  },

  /** Delete many objects at once. */
  async removeMany(keys: string[]): Promise<Result<{ deleted: string[] }>> {
    const cfg = ensureConfigured();
    if (!cfg.ok) return cfg;
    if (keys.length === 0) return ok({ deleted: [] });
    for (const k of keys) {
      const safe = assertSafeKey(k);
      if (!safe.ok) return safe;
    }
    try {
      await getS3().send(
        new DeleteObjectsCommand({
          Bucket: getBucket(),
          Delete: { Objects: keys.map((Key) => ({ Key })) },
        }),
      );
      return ok({ deleted: keys });
    } catch (e) {
      return fail(AppErrors.internal(e instanceof Error ? e.message : "Bulk delete failed"));
    }
  },

  /** Copy an object to a new key (same bucket). */
  async copy(fromKey: string, toFolder: string, newName?: string): Promise<Result<StorageObject>> {
    const cfg = ensureConfigured();
    if (!cfg.ok) return cfg;
    const safeFrom = assertSafeKey(fromKey);
    if (!safeFrom.ok) return safeFrom;
    if (!isValidFolder(toFolder)) {
      return fail(AppErrors.validation(`Unknown folder "${toFolder}"`));
    }
    const baseName = newName ?? fromKey.split("/").pop() ?? "file";
    const toKey = buildKey(toFolder, baseName);
    try {
      await getS3().send(
        new CopyObjectCommand({
          Bucket: getBucket(),
          CopySource: `${getBucket()}/${fromKey}`,
          Key: toKey,
        }),
      );
      return ok(toObject(toKey, 0));
    } catch (e) {
      return fail(AppErrors.internal(e instanceof Error ? e.message : "Copy failed"));
    }
  },

  /** Move = copy then delete the original. */
  async move(fromKey: string, toFolder: string, newName?: string): Promise<Result<StorageObject>> {
    const copied = await this.copy(fromKey, toFolder, newName);
    if (!copied.ok) return copied;
    const removed = await this.remove(fromKey);
    if (!removed.ok) return removed;
    return copied;
  },
};
