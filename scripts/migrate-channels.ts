/**
 * One-time backfill for the Website / App visibility switches.
 *
 *   npm run migrate:channels            dry run: only counts, writes nothing
 *   npm run migrate:channels -- --apply sets channels = { web: true, app: true }
 *   (PowerShell drops the `--`; there run:
 *    npx tsx --require ./scripts/server-only-shim.cjs scripts/migrate-channels.ts --apply)
 *
 * Only touches documents that have NO `channels` (or a partial one), so every
 * existing service and pooja stays visible on both website and app exactly as
 * before. Never turns anything off. Safe to re-run.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
const envPath = path.join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

const COLLECTIONS = ["services", "poojas"];

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  const apply = process.argv.includes("--apply");
  const { connectMongoose } = await import("../src/core/db/mongoose");
  await connectMongoose();
  const mongoose = (await import("mongoose")).default;

  for (const name of COLLECTIONS) {
    const col = mongoose.connection.collection(name);
    const total = await col.countDocuments({});
    const noWeb = { "channels.web": { $exists: false } };
    const noApp = { "channels.app": { $exists: false } };
    const [missWeb, missApp] = await Promise.all([col.countDocuments(noWeb), col.countDocuments(noApp)]);
    console.log(`${name}: ${total} total, ${missWeb} missing website flag, ${missApp} missing app flag`);
    if (!apply) continue;
    // Separate updates so an existing explicit value is never overwritten.
    const [w, a] = await Promise.all([
      col.updateMany(noWeb, { $set: { "channels.web": true } }),
      col.updateMany(noApp, { $set: { "channels.app": true } }),
    ]);
    console.log(`  → set website on ${w.modifiedCount}, app on ${a.modifiedCount}`);
  }
  if (!apply) console.log("\nDry run. Re-run with --apply to write.");
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
