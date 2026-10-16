import "server-only";

/**
 * S3 client singleton + low-level helpers.
 *
 * Server-only. The admin media service (modules/media or wherever) builds on
 * top of this; the storefront never imports it. Credentials come from env
 * (validated in core/config/env). If S3 is not configured, `isConfigured()`
 * returns false and callers surface a clean "storage not configured" error
 * instead of crashing.
 */

import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/core/config/env";

/** Is S3 fully configured (keys + region + bucket present)? */
export function isS3Configured(): boolean {
  return Boolean(
    env.AWS_ACCESS_KEY_ID &&
      env.AWS_SECRET_ACCESS_KEY &&
      env.AWS_REGION &&
      env.AWS_S3_BUCKET,
  );
}

export function getBucket(): string {
  if (!env.AWS_S3_BUCKET) throw new Error("AWS_S3_BUCKET is not configured");
  return env.AWS_S3_BUCKET;
}

export function getRegion(): string {
  return env.AWS_REGION ?? "ap-south-1";
}

declare global {
  // eslint-disable-next-line no-var
  var __s3Client: S3Client | undefined;
}

/** Shared S3 client (cached across hot reloads in dev). */
export function getS3(): S3Client {
  if (!isS3Configured()) {
    throw new Error("S3 is not configured. Set AWS keys, region and bucket in .env");
  }
  if (!global.__s3Client) {
    global.__s3Client = new S3Client({
      region: getRegion(),
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return global.__s3Client;
}

/** Public URL for an object key (virtual-hosted–style). */
export function publicUrl(key: string): string {
  return `https://${getBucket()}.s3.${getRegion()}.amazonaws.com/${encodeURI(key)}`;
}
