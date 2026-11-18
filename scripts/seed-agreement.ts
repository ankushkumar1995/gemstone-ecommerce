/**
 * Seed the first partner agreement (v3.2) as the published version.
 *
 *   npm run seed:agreement
 *
 * Idempotent: does nothing if any agreement version already exists (never
 * touches published text or signatures). Uses MONGODB_URI from .env.
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

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  const { agreementService } = await import("../src/modules/agreements");
  const { DEFAULT_AGREEMENT } = await import("../src/modules/agreements/agreement.default");
  const { getAgreementRepository } = await import("../src/modules/agreements/agreement.repository");
  const mongoose = (await import("mongoose")).default;

  const existing = await getAgreementRepository().listVersions();
  if (existing.length > 0) {
    console.log(`Skipped: ${existing.length} agreement version(s) already exist (${existing.map((v) => `v${v.version} ${v.status}`).join(", ")}).`);
  } else {
    const actor = { name: "System (seed)" };
    const draft = await agreementService.createDraft(DEFAULT_AGREEMENT, actor);
    if (!draft.ok) throw new Error(`Draft failed: ${draft.error.message}`);
    // Keep the seeded deadline in the future so publishing is allowed.
    if (Date.parse(draft.value.signDeadline) <= Date.now()) {
      const upd = await agreementService.updateDraft(draft.value.id, { signDeadline: new Date(Date.now() + 30 * 86400_000).toISOString() }, actor);
      if (!upd.ok) throw new Error(`Deadline update failed: ${upd.error.message}`);
    }
    const pub = await agreementService.publish(draft.value.id, DEFAULT_AGREEMENT.version, actor);
    if (!pub.ok) throw new Error(`Publish failed: ${pub.error.message}`);
    console.log(`Published partner agreement v${pub.value.version} (sign by ${pub.value.signDeadline}). Hash ${pub.value.contentHash}`);
  }
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
