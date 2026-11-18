import "server-only";

/**
 * Photo optimiser (sharp). Phone photos are often 12 to 50 MP and 3 to 10 MB;
 * the app shows them full screen on a phone, so 1600 px on the long side is
 * plenty and loads in a moment on mobile data.
 *
 *   • turns the picture upright from the camera's EXIF orientation
 *   • shrinks to `maxSide` (never enlarges)
 *   • saves as JPEG (works everywhere: app, website, emails, WhatsApp previews);
 *     transparent PNGs are put on white
 *   • drops all metadata (GPS location, camera, date), which matters for privacy
 *
 * Never throws: an image sharp cannot read returns `null` so the caller can refuse it.
 */

export interface OptimizedImage { body: Buffer; contentType: "image/jpeg"; width: number; height: number; bytes: number }

export async function optimizePhoto(input: Buffer | Uint8Array, opts: { maxSide?: number; quality?: number } = {}): Promise<OptimizedImage | null> {
  const maxSide = opts.maxSide ?? 1600;
  try {
    const sharp = (await import("sharp")).default;
    // limitInputPixels guards against "decompression bomb" files.
    const { data, info } = await sharp(Buffer.from(input), { limitInputPixels: 120_000_000, failOn: "error" })
      .rotate()
      .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: opts.quality ?? 80, mozjpeg: true, progressive: true })
      .toBuffer({ resolveWithObject: true });
    return { body: data, contentType: "image/jpeg", width: info.width, height: info.height, bytes: data.byteLength };
  } catch {
    return null;
  }
}
