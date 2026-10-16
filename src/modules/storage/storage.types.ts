/**
 * Storage (S3) domain — types. The admin media/upload layer uses these.
 */

/** A stored object as the admin UI sees it. */
export interface StorageObject {
  key: string; // full S3 key, e.g. "products/abc-123.jpg"
  url: string; // public URL
  size: number; // bytes
  contentType?: string;
  lastModified?: string; // ISO
  folder: string; // derived prefix, e.g. "products"
  name: string; // file name without the folder prefix
}

/** A listing result: objects in a folder + any sub-folders (common prefixes). */
export interface StorageListing {
  folder: string;
  objects: StorageObject[];
  subfolders: string[];
}

/** Result of a direct (server-proxied) upload. */
export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

/** A presigned POST/PUT ticket for direct browser→S3 upload. */
export interface PresignedUpload {
  key: string;
  url: string; // presigned PUT URL
  publicUrl: string; // where the file will be reachable after upload
  expiresIn: number; // seconds
  headers: Record<string, string>; // headers the client must send with PUT
}

/** Allowed top-level folders for admin uploads (keeps the bucket organised). */
export const STORAGE_FOLDERS = [
  "products",
  "categories",
  "collections",
  "blog",
  "banners",
  "services",
  "pages",
  "media",
  "misc",
] as const;

export type StorageFolder = (typeof STORAGE_FOLDERS)[number];
