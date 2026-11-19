/**
 * One-off: load the mantras, aarti, chalisa and katha the app shipped with into
 * the admin-managed `devotional_items` collection (upsert by slug, so it is
 * safe to run again; admin edits to the same slug are overwritten).
 *
 *   npx tsx --env-file=.env --require ./scripts/server-only-shim.cjs scripts/seed-devotional.ts [--dry] [--from <path to the app's mocks/devotional.ts>]
 *
 * Old app ids ("m-gayatri", "l-jagdish") become the slugs, so saved sadhanas
 * and deep links keep working. Audio is not included: upload it in admin.
 *
 * The app's data file is loaded at run time (default: the sibling
 * astrounkle-app checkout). It must not be a static import: the app folder
 * does not exist on Vercel, and `next build` type-checks every .ts file, so a
 * static import here breaks the deploy.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { devotionalService } from "@/modules/devotional";

const DRY = process.argv.includes("--dry");
const fromArg = process.argv.indexOf("--from");
const SOURCE = path.resolve(fromArg > -1 && process.argv[fromArg + 1] ? process.argv[fromArg + 1] : path.join(process.cwd(), "..", "astrounkle-app", "src", "mocks", "devotional.ts"));

interface AppMantra { id: string; title: string; deity: string; devanagari: string; roman: string; meaning: string; when: string; seconds: number }
interface AppLibraryItem { id: string; kind: string; title: string; hindiTitle: string; deity: string; blurb: string; lines: string[] }

async function loadAppData(): Promise<{ mantras: AppMantra[]; library: AppLibraryItem[] }> {
  const mod = (await import(pathToFileURL(SOURCE).href)) as { mantras?: AppMantra[]; library?: AppLibraryItem[] };
  if (!Array.isArray(mod.mantras) || !Array.isArray(mod.library)) throw new Error(`No mantras / library exported by ${SOURCE}`);
  return { mantras: mod.mantras, library: mod.library };
}

/** Traditional weekday (0 = Sunday) and graha for each deity. */
const DEITY: Record<string, { days: number[]; planets: string[] }> = {
  Shiva: { days: [1], planets: ["Moon"] },
  Savitri: { days: [0, 1, 2, 3, 4, 5, 6], planets: ["Sun"] },
  Ganesha: { days: [3], planets: ["Mercury", "Ketu"] },
  Hanuman: { days: [2, 6], planets: ["Mars", "Saturn"] },
  Lakshmi: { days: [5], planets: ["Venus"] },
  Vishnu: { days: [4], planets: ["Jupiter"] },
  Surya: { days: [0], planets: ["Sun"] },
  Shani: { days: [6], planets: ["Saturn"] },
};
const FESTIVALS: Record<string, string[]> = { "l-ekadashi": ["ekadashi"], "l-kartik-purnima": ["purnima"], "l-shiv": ["shivratri", "mahashivratri"], "l-jagdish": ["gita jayanti", "vivah panchami"] };

async function main() {
  const { mantras, library } = await loadAppData();
  const rows: Record<string, unknown>[] = [];
  mantras.forEach((m, i) => {
    const d = DEITY[m.deity] ?? { days: [], planets: [] };
    rows.push({
      slug: m.id, kind: "mantra", status: "published", title: m.title, titleHi: "", deity: m.deity,
      devanagari: m.devanagari, roman: m.roman, meaning: { en: m.meaning, hi: "" }, blurb: m.meaning.slice(0, 280),
      bestTime: m.when, days: d.days, planets: d.planets, defaultCount: 108, recitationSec: m.seconds,
      featured: m.id === "m-gayatri" || m.id === "m-mrityunjaya", order: (i + 1) * 10,
    });
  });
  library.forEach((l, i) => {
    rows.push({
      slug: l.id, kind: l.kind, status: "published", title: l.title, titleHi: l.hindiTitle, deity: l.deity,
      devanagari: (l.lines[0] ?? "").split("\n")[0].slice(0, 400), blurb: l.blurb.slice(0, 300), verses: l.lines,
      festivals: FESTIVALS[l.id] ?? [], defaultCount: 1, recitationSec: 300, order: (i + 1) * 10,
    });
  });
  const r = await devotionalService.importMany(rows, "Seed script", DRY);
  if (!r.ok) throw new Error(r.error.message);
  console.log(`${DRY ? "DRY RUN: " : ""}${r.value.created} new, ${r.value.updated} updated, ${r.value.failed.length} skipped`);
  for (const f of r.value.failed) console.log(`  row ${f.row} (${f.slug}): ${f.error}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => mongoose.disconnect().catch(() => undefined));
