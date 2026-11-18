/**
 * One-off: shrink astrologer photos that were uploaded before resizing existed.
 *
 *   npx tsx --env-file=.env --require ./scripts/server-only-shim.cjs scripts/optimize-astro-photos.ts          (dry run: lists what it would do)
 *   npx tsx --env-file=.env --require ./scripts/server-only-shim.cjs scripts/optimize-astro-photos.ts --apply  (does it)
 *
 * For every astrologer photo (live profile and a photo waiting for review) that
 * is bigger than 400 KB or 1600 px: download, make upright + 1600 px JPEG
 * without metadata, upload as a new file, point the profile (and any live
 * session copies) to it. Old files are left in S3, so this can be undone by
 * putting the old URL back. Safe to run again: small photos are skipped.
 */
import mongoose from "mongoose";
import { optimizePhoto } from "@/core/images";
import { storageService } from "@/modules/storage";

const APPLY = process.argv.includes("--apply");
const MAX_BYTES = 400 * 1024;

async function fetchBytes(url: string): Promise<Buffer | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch { return null; }
}

async function shrink(url: string, slug: string): Promise<{ url: string; before: number; after: number; size: string } | "skip" | "error"> {
  const raw = await fetchBytes(url);
  if (!raw) return "error";
  const sharp = (await import("sharp")).default;
  const meta = await sharp(raw).metadata().catch(() => null);
  if (!meta) return "error";
  if (raw.byteLength <= MAX_BYTES && Math.max(meta.width ?? 0, meta.height ?? 0) <= 1600) return "skip";
  const img = await optimizePhoto(raw, { maxSide: 1600 });
  if (!img) return "error";
  if (!APPLY) return { url: "(dry run)", before: raw.byteLength, after: img.bytes, size: `${meta.width}x${meta.height} → ${img.width}x${img.height}` };
  const up = await storageService.upload({ folder: "astrologers", fileName: `${slug}.jpg`, contentType: img.contentType, body: img.body });
  if (!up.ok) return "error";
  return { url: up.value.url, before: raw.byteLength, after: img.bytes, size: `${meta.width}x${meta.height} → ${img.width}x${img.height}` };
}

async function main() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  const db = mongoose.connection.db!;
  console.log(`DB ${db.databaseName} · ${APPLY ? "APPLY" : "dry run (add --apply to write)"}`);
  const rows = await db.collection("astrologers").find({ $or: [{ photo: { $type: "string", $ne: "" } }, { "pendingChanges.photo": { $type: "string", $ne: "" } }] })
    .project({ slug: 1, displayName: 1, photo: 1, "pendingChanges.photo": 1 }).toArray();
  let changed = 0;
  for (const a of rows) {
    for (const field of ["photo", "pendingChanges.photo"] as const) {
      const url = field === "photo" ? (a.photo as string | undefined) : (a.pendingChanges as { photo?: string } | undefined)?.photo;
      if (!url || !/^https?:\/\//i.test(url)) continue;
      const r = await shrink(url, String(a.slug));
      if (r === "skip") { console.log(`  skip   ${a.displayName} (${field}) already small`); continue; }
      if (r === "error") { console.log(`  ERROR  ${a.displayName} (${field}) could not read ${url}`); continue; }
      console.log(`  shrink ${a.displayName} (${field}) ${r.size} · ${Math.round(r.before / 1024)} KB → ${Math.round(r.after / 1024)} KB`);
      if (!APPLY) continue;
      await db.collection("astrologers").updateOne({ _id: a._id }, { $set: { [field]: r.url } });
      if (field === "photo") await db.collection("live_sessions").updateMany({ astrologerId: String(a._id), "astrologer.photo": url }, { $set: { "astrologer.photo": r.url } });
      changed++;
    }
  }
  console.log(`\n${rows.length} astrologers checked · ${APPLY ? `${changed} photos replaced` : "nothing written"}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => mongoose.disconnect().catch(() => undefined));
