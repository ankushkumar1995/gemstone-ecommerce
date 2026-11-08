/**
 * Seed 5 ready-to-book havans / yagyas (status "active", type "havan").
 *
 *   npm run seed:havans
 *
 * Same rules as the admin (zod schema + publish checks), audited as
 * "Seed script". Safe to re-run: an existing URL (slug) is skipped.
 * Uses DATA_SOURCE_POOJAS / MONGODB_URI from .env.
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

const SAMAGRI = ["Desi cow ghee", "Mango wood samidha", "Havan samagri", "Kala til (black sesame)", "Jau (barley)", "Guggal", "Kapoor", "Navgrah samidha"];
const bhasma = { id: "bhasma", name: "Havan bhasma & raksha sutra", kind: "prasad" as const, description: "Blessed bhasma, raksha sutra and prasad couriered to your home.", price: 251, maxQty: 1, requiresAddress: true, active: true };
const live = { id: "live", name: "Live darshan link", kind: "live_video" as const, description: "Watch the purnahuti live on YouTube.", price: 0, maxQty: 1, requiresAddress: false, active: true };
const daan = { id: "brahmin-bhoj", name: "Brahmin bhojan (5 pandits)", kind: "daan" as const, description: "Bhojan seva for pandits in your name after the havan.", price: 1100, maxQty: 3, requiresAddress: false, active: true };

type Pkg = { id: string; name: string; kind: "individual" | "couple" | "family" | "group"; members: number; price: number; mrp: number | null; description: string; perks: string[]; popular?: boolean; jaapCount?: number; ahutiCount?: number; panditCount?: number };
type Seed = {
  slug: string; title: string; subtitle: string; deity: string; category: string; tags: string[]; shortDescription: string; description: string;
  benefits: string[]; vidhi: string[]; includes: string[]; faqs: { q: string; a: string }[]; coverImage: string;
  location: { mode: "temple" | "ashram" | "our_pandits"; place: string; city: string; state: string };
  durationMin: number; panditCount: number; mantraCount: number; packages: Pkg[];
  havan: { mode: "ekal" | "samuhik"; durationDays: number; kundCount: number; deliverables: string[] };
  schedule: { mode: "weekly" | "on_request"; weekdays?: number[]; times?: string[]; slotCapacity: number; cutoffHours: number; advanceDays: number };
  featured: boolean; sortOrder: number;
};

const SEEDS: Seed[] = [
  {
    slug: "maha-mrityunjaya-anushthan", title: "Maha Mrityunjaya Jaap & Havan", subtitle: "11-day anushthan for health, long life and protection",
    deity: "Lord Shiva", category: "health", tags: ["mahamrityunjaya", "anushthan", "health", "shiv", "jaap"],
    shortDescription: "An 11-day anushthan of Maha Mrityunjaya mantra jaap with a closing havan, for recovery from illness, long life and freedom from fear.",
    description: "The Maha Mrityunjaya mantra from the Rigveda is chanted for healing and protection. Over 11 days our acharyas complete the chosen jaap count with your name and gotra in the sankalp.\n\nOn the last day, a havan of one tenth of the jaap (dashansh) is offered in the agni with ghee, til and samidha, followed by purnahuti.",
    benefits: ["Helps recovery from long or serious illness", "Protection from accidents and untimely fears", "Peace of mind and inner strength", "Calms the effects of difficult dashas"],
    vidhi: ["Ganesh pujan and sankalp with your name and gotra", "Kalash and Shiv sthapana", "Daily Maha Mrityunjaya mantra jaap by the pandits", "Dashansh havan on the last day", "Purnahuti, aarti and blessings"],
    includes: ["Sankalp in your name and gotra", "Daily progress update", "Full purnahuti video", "Havan bhasma (with add-on)"],
    faqs: [
      { q: "Do I need to do anything during the 11 days?", a: "No. The pandits complete the jaap in your name. You may chant along at home if you wish." },
      { q: "Can I include family members?", a: "Yes. Each package allows a set number of names in the sankalp." },
    ],
    coverImage: "/images/image1.png",
    location: { mode: "temple", place: "Kashi Vishwanath Dham", city: "Varanasi", state: "Uttar Pradesh" },
    durationMin: 180, panditCount: 5, mantraCount: 125000,
    packages: [
      { id: "jaap-11k", name: "11,000 Jaap", kind: "individual", members: 1, price: 5100, mrp: 6500, description: "Anushthan for one person.", perks: ["1 name", "Daily update", "Purnahuti video"], jaapCount: 11000, ahutiCount: 1100, panditCount: 3 },
      { id: "jaap-51k", name: "51,000 Jaap", kind: "family", members: 4, price: 11000, mrp: 14000, description: "For you and your family.", perks: ["Up to 4 names", "Daily update", "Purnahuti video"], popular: true, jaapCount: 51000, ahutiCount: 5100, panditCount: 5 },
      { id: "jaap-125k", name: "1,25,000 Jaap", kind: "family", members: 6, price: 31000, mrp: 38000, description: "The complete sava lakh anushthan.", perks: ["Up to 6 names", "11 pandits", "Live purnahuti"], jaapCount: 125000, ahutiCount: 12500, panditCount: 11 },
    ],
    havan: { mode: "samuhik", durationDays: 11, kundCount: 1, deliverables: ["Havan bhasma", "Raksha sutra", "Daily progress update", "Purnahuti video"] },
    schedule: { mode: "weekly", weekdays: [1], times: ["07:00"], slotCapacity: 20, cutoffHours: 24, advanceDays: 60 },
    featured: true, sortOrder: 10,
  },
  {
    slug: "navagraha-shanti-havan", title: "Navagraha Shanti Havan", subtitle: "Ahutis for all nine planets",
    deity: "Navagraha", category: "graha_shanti", tags: ["navagraha", "havan", "graha shanti", "shani", "rahu"],
    shortDescription: "A havan with specific samidha and mantras for each of the nine planets, to reduce malefic effects and bring balance in life.",
    description: "Each graha is offered its own mantra and samidha in the agni: arka for Surya, palash for Chandra, khadir for Mangal and so on. This brings the nine planets into harmony with your birth chart.",
    benefits: ["Reduces malefic planetary effects", "Helps during Sade Sati and tough dashas", "Balance in health, career and relationships"],
    vidhi: ["Sankalp with name and birth details", "Navagraha mandal sthapana", "Ahutis with the samidha of each planet", "Purnahuti and aarti"],
    includes: ["Sankalp with your birth details", "Havan by 3 pandits", "Havan video"],
    faqs: [{ q: "Is my birth time needed?", a: "It helps, but the havan can be done with your name and date of birth." }],
    coverImage: "/images/vedic-gemstone-astrology.png",
    location: { mode: "our_pandits", place: "", city: "Haridwar", state: "Uttarakhand" },
    durationMin: 120, panditCount: 3, mantraCount: 0,
    packages: [
      { id: "single", name: "Individual", kind: "individual", members: 1, price: 2500, mrp: 3100, description: "For one person.", perks: ["1 name", "Havan video"], popular: true, ahutiCount: 1008, panditCount: 3 },
      { id: "family", name: "Family", kind: "family", members: 4, price: 4100, mrp: 5100, description: "For up to 4 family members.", perks: ["Up to 4 names", "Havan video"], ahutiCount: 1008, panditCount: 3 },
    ],
    havan: { mode: "samuhik", durationDays: 1, kundCount: 1, deliverables: ["Havan bhasma", "Havan video"] },
    schedule: { mode: "weekly", weekdays: [6], times: ["08:00"], slotCapacity: 30, cutoffHours: 24, advanceDays: 60 },
    featured: true, sortOrder: 20,
  },
  {
    slug: "ganpati-homa-ekal", title: "Ganpati Homa (Ekal)", subtitle: "For new beginnings, only for your family",
    deity: "Lord Ganesha", category: "career", tags: ["ganpati", "ganesh homa", "new business", "griha pravesh", "ekal"],
    shortDescription: "An exclusive Ganpati homa performed only for your family, before a new home, business, job or any important start.",
    description: "Lord Ganesha removes obstacles from every new beginning. In this ekal homa only your family's names are taken, with modak, durva and ghee offered in the agni with the Ganapati Atharvashirsha.",
    benefits: ["Removes obstacles from new work", "Blessings for a new home or business", "Success and clarity in decisions"],
    vidhi: ["Sankalp with your family names", "Ganesh pujan with durva and modak", "Ganapati Atharvashirsha path", "Homa with 108 ahutis", "Purnahuti and aarti"],
    includes: ["Only your family in the sankalp", "Pick any date", "Homa video"],
    faqs: [{ q: "Can I choose the date?", a: "Yes. Pick any open date. Ekal means only one family is booked per date." }],
    coverImage: "/images/image3.png",
    location: { mode: "our_pandits", place: "", city: "Pune", state: "Maharashtra" },
    durationMin: 90, panditCount: 2, mantraCount: 1008,
    packages: [
      { id: "family", name: "Family Homa", kind: "family", members: 6, price: 5100, mrp: 6100, description: "Exclusive homa for your family.", perks: ["Up to 6 names", "Any date", "Homa video"], popular: true, ahutiCount: 108, panditCount: 2 },
    ],
    havan: { mode: "ekal", durationDays: 1, kundCount: 1, deliverables: ["Havan bhasma", "Modak prasad", "Homa video"] },
    schedule: { mode: "on_request", slotCapacity: 1, cutoffHours: 48, advanceDays: 60 },
    featured: false, sortOrder: 30,
  },
  {
    slug: "lakshmi-kubera-havan", title: "Lakshmi Kubera Havan", subtitle: "For wealth, savings and business growth",
    deity: "Goddess Lakshmi & Kubera", category: "wealth", tags: ["lakshmi", "kubera", "wealth", "business", "friday"],
    shortDescription: "Shri Sukta and Kubera mantra havan with lotus seeds and ghee, every Friday evening, for steady income and growth.",
    description: "This havan invokes Goddess Lakshmi and Lord Kubera, the keeper of wealth. Kamal gatta (lotus seeds), ghee and kheer are offered with the Shri Sukta and Kubera mantras.",
    benefits: ["Steady income and savings", "Growth in business", "Relief from money blocks and debts"],
    vidhi: ["Sankalp with your name", "Lakshmi and Kubera pujan", "Shri Sukta path", "Havan with kamal gatta and ghee", "Aarti and prasad"],
    includes: ["Sankalp in your name", "Havan video", "Energised Kubera yantra photo blessing"],
    faqs: [{ q: "Why Friday?", a: "Friday is the day of Goddess Lakshmi, so this havan is done every Friday evening." }],
    coverImage: "/images/Celestial Gemstone Temple Still Life.png",
    location: { mode: "temple", place: "Shri Mahalakshmi Temple", city: "Kolhapur", state: "Maharashtra" },
    durationMin: 90, panditCount: 2, mantraCount: 1008,
    packages: [
      { id: "single", name: "Individual", kind: "individual", members: 1, price: 2100, mrp: 2700, description: "For one person.", perks: ["1 name", "Havan video"], ahutiCount: 1008, panditCount: 2 },
      { id: "business", name: "Business", kind: "family", members: 5, price: 4100, mrp: 5100, description: "Owner, partners and the business name.", perks: ["Up to 5 names", "Business name in sankalp"], popular: true, ahutiCount: 1008, panditCount: 3 },
    ],
    havan: { mode: "samuhik", durationDays: 1, kundCount: 1, deliverables: ["Havan bhasma", "Kamal gatta prasad", "Havan video"] },
    schedule: { mode: "weekly", weekdays: [5], times: ["18:30"], slotCapacity: 40, cutoffHours: 24, advanceDays: 60 },
    featured: false, sortOrder: 40,
  },
  {
    slug: "pitru-shanti-havan", title: "Pitru Shanti Havan & Tarpan", subtitle: "Peace for ancestors, blessings for the family",
    deity: "Pitru Devta", category: "ancestors", tags: ["pitru dosh", "tarpan", "shradh", "ancestors", "haridwar"],
    shortDescription: "Tarpan and havan for the peace of departed ancestors, done at the ghats of Haridwar, to calm pitru dosh and bring family harmony.",
    description: "Pitru shanti brings peace to the souls of our ancestors and removes obstacles caused by pitru dosh. Tarpan is offered with til and water, followed by a havan with the Pitru Sukta.",
    benefits: ["Calms pitru dosh", "Harmony and progress in the family", "Blessings of the ancestors"],
    vidhi: ["Sankalp with family and ancestor names", "Tarpan with til and Ganga jal", "Pitru Sukta path", "Havan and purnahuti", "Brahmin daan"],
    includes: ["Ancestor names in the sankalp", "Tarpan at Haridwar ghat", "Havan video"],
    faqs: [{ q: "Which ancestors can be included?", a: "You can include up to three generations on both the father's and mother's side." }],
    coverImage: "/images/image2.png",
    location: { mode: "temple", place: "Har Ki Pauri", city: "Haridwar", state: "Uttarakhand" },
    durationMin: 150, panditCount: 3, mantraCount: 0,
    packages: [
      { id: "family", name: "Family", kind: "family", members: 8, price: 5100, mrp: 6500, description: "For the whole family and ancestors.", perks: ["Up to 8 names", "Tarpan + havan", "Havan video"], popular: true, ahutiCount: 1008, panditCount: 3 },
    ],
    havan: { mode: "samuhik", durationDays: 1, kundCount: 1, deliverables: ["Havan bhasma", "Tarpan video", "Havan video"] },
    schedule: { mode: "weekly", weekdays: [0], times: ["07:30"], slotCapacity: 25, cutoffHours: 48, advanceDays: 60 },
    featured: false, sortOrder: 50,
  },
];

async function main() {
  const { poojaService, poojaCategoryService, poojaInputSchema, blankPolicy, blankSankalp } = await import("../src/modules/poojas");
  const actor = { name: "Seed script" };
  const source = process.env.DATA_SOURCE_POOJAS || process.env.DATA_SOURCE || "mock";
  console.log(`Seeding havans into: ${source}${source === "mongo" ? "" : "  (not saved to a database; set DATA_SOURCE_POOJAS=mongo)"}`);
  const cats = await poojaCategoryService.list();
  const keys = new Set(cats.map((c) => c.key));
  let added = 0, skipped = 0, failed = 0;

  for (const s of SEEDS) {
    const input = poojaInputSchema.safeParse({
      ...s,
      type: "havan",
      category: keys.has(s.category) ? s.category : cats[0]?.key,
      gallery: [], videoUrl: "",
      location: { ...s.location, mapUrl: "" },
      havan: { ...s.havan, liveUrl: "", samagri: SAMAGRI },
      packages: s.packages.map((p) => ({ ...p, popular: Boolean(p.popular), active: true, jaapCount: p.jaapCount ?? null, ahutiCount: p.ahutiCount ?? null, panditCount: p.panditCount ?? null })),
      addOns: s.location.mode === "temple" ? [bhasma, live, daan] : [bhasma, live],
      schedule: { weekdays: [], times: [], fixedDates: [], blackoutDates: [], ...s.schedule },
      policy: blankPolicy(),
      sankalp: { ...blankSankalp(), requireDob: s.category === "graha_shanti", instructions: "Write names exactly as you want them spoken in the sankalp." },
      seo: { title: `${s.title} Online Booking`.slice(0, 70), description: s.shortDescription.slice(0, 170) },
      status: "active",
    });
    if (!input.success) { console.log(`✗ ${s.title}: ${input.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`); failed++; continue; }
    const r = await poojaService.create(input.data, actor);
    if (r.ok) { console.log(`✓ added   ${r.value.title}  →  /havan/${r.value.slug}`); added++; }
    else if (r.error.code === "CONFLICT") { console.log(`• skipped ${s.title} (already exists)`); skipped++; }
    else { console.log(`✗ ${s.title}: ${r.error.message}`); failed++; }
  }
  console.log(`\nDone: ${added} added, ${skipped} skipped, ${failed} failed.`);
  if (source === "mongo") (await import("mongoose")).default.disconnect().catch(() => {});
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exit(1); });
