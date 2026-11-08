/**
 * Seed 5 ready-to-book poojas (status "active").
 *
 *   npm run seed:poojas
 *
 * • Goes through the same service the admin uses, so every pooja passes the
 *   zod schema and the publish checks, and is audited as "Seed script".
 * • Safe to run again: a pooja whose URL (slug) already exists is skipped.
 * • Uses DATA_SOURCE_POOJAS / MONGODB_URI from .env (mongo → real database).
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/* Load .env before any app module reads process.env. */
const envPath = path.join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

type Seed = {
  slug: string; title: string; subtitle: string; deity: string; category: string; tags: string[];
  shortDescription: string; description: string; benefits: string[]; vidhi: string[]; includes: string[];
  faqs: { q: string; a: string }[]; coverImage: string; gallery: string[];
  location: { mode: "temple" | "ashram" | "our_pandits"; place: string; city: string; state: string };
  durationMin: number; panditCount: number; mantraCount: number;
  packages: { id: string; name: string; kind: "individual" | "couple" | "family" | "group"; members: number; price: number; mrp: number | null; description: string; perks: string[]; popular?: boolean }[];
  schedule: { mode: "weekly" | "fixed_dates" | "on_request"; weekdays?: number[]; times?: string[]; slotCapacity: number; cutoffHours: number; advanceDays: number };
  featured: boolean; sortOrder: number;
};

const prasad = { id: "prasad", name: "Prasad delivery", kind: "prasad" as const, description: "Blessed prasad, tilak and raksha sutra couriered to your home.", price: 251, maxQty: 1, requiresAddress: true, active: true };
const recording = { id: "hd-video", name: "Full HD pooja video", kind: "recording" as const, description: "Complete pooja video with your name in the sankalp.", price: 0, maxQty: 1, requiresAddress: false, active: true };
const daan = { id: "anna-daan", name: "Anna daan (feed 11 people)", kind: "daan" as const, description: "Bhojan seva in your name at the temple.", price: 551, maxQty: 5, requiresAddress: false, active: true };

const SEEDS: Seed[] = [
  {
    slug: "rudrabhishek-pooja-kashi", title: "Rudrabhishek Pooja", subtitle: "For health, peace and removal of obstacles",
    deity: "Lord Shiva", category: "health", tags: ["shiv", "rudrabhishek", "health", "sawan", "kashi"],
    shortDescription: "Abhishek of the Shivling with milk, honey, ghee and Ganga jal while Rudra mantras are chanted, performed in your name at Kashi.",
    description: "Rudrabhishek is one of the most powerful offerings to Lord Shiva. Learned pandits bathe the Shivling with panchamrit and Ganga jal while reciting the Shri Rudram from the Yajurveda.\n\nIt is done for good health, mental peace, relief from long illness and to calm the effects of difficult planetary periods. Your name and gotra are taken in the sankalp before the abhishek begins.",
    benefits: ["Good health and faster recovery", "Peace of mind and less stress", "Removes obstacles in work and family", "Calms the effects of Rahu, Ketu and Shani"],
    vidhi: ["Ganesh pujan and sankalp with your name and gotra", "Kalash sthapana and Shiv avahan", "Abhishek with milk, curd, honey, ghee and Ganga jal", "Chanting of Shri Rudram (Namakam and Chamakam)", "Bilva patra archana and aarti", "Prasad distribution and blessings"],
    includes: ["Sankalp in your name and gotra", "Rudrabhishek by 2 Vedic pandits", "Pooja video on WhatsApp within 48 hours"],
    faqs: [
      { q: "Do I need to be present?", a: "No. The pooja is performed in your name. You receive the video after the pooja." },
      { q: "What if I don't know my gotra?", a: "Leave it empty. Traditionally Kashyap gotra is used in the sankalp." },
    ],
    coverImage: "/images/image1.png", gallery: ["/images/image2.png"],
    location: { mode: "temple", place: "Kashi Vishwanath Dham", city: "Varanasi", state: "Uttar Pradesh" },
    durationMin: 90, panditCount: 2, mantraCount: 1100,
    packages: [
      { id: "single", name: "Individual", kind: "individual", members: 1, price: 1100, mrp: 1500, description: "Rudrabhishek for one person.", perks: ["1 name in sankalp", "Pooja video"] },
      { id: "family", name: "Family", kind: "family", members: 4, price: 2100, mrp: 2800, description: "For you and your family, up to 4 names.", perks: ["Up to 4 names", "Pooja video", "Priority slot"], popular: true },
    ],
    schedule: { mode: "weekly", weekdays: [1, 4], times: ["07:00", "18:00"], slotCapacity: 50, cutoffHours: 12, advanceDays: 60 },
    featured: true, sortOrder: 10,
  },
  {
    slug: "maha-lakshmi-pooja", title: "Maha Lakshmi Pooja", subtitle: "For wealth, prosperity and success in business",
    deity: "Goddess Lakshmi", category: "wealth", tags: ["lakshmi", "wealth", "business", "diwali", "friday"],
    shortDescription: "Shri Sukta path and Lakshmi archana for steady income, savings and growth in business, every Friday evening.",
    description: "Goddess Lakshmi blesses the home with wealth, abundance and good fortune. This pooja includes the Shri Sukta path, Kanakdhara stotra and 108 names archana with lotus and kumkum.\n\nIt is especially good before starting a new business, for debt relief and for steady growth in income.",
    benefits: ["Steady income and savings", "Growth in business and new opportunities", "Relief from debts and money blocks", "Harmony and abundance at home"],
    vidhi: ["Sankalp with your name and gotra", "Ganesh and Kalash pujan", "Shri Sukta path (16 verses)", "Kanakdhara stotra and Lakshmi ashtottara archana", "Kamal (lotus) and kumkum offering", "Aarti and prasad"],
    includes: ["Sankalp in your name", "Shri Sukta and Kanakdhara path", "Pooja video", "Energised Shri Yantra photo blessing"],
    faqs: [{ q: "Which day is best?", a: "Friday is the day of Goddess Lakshmi, so this pooja is performed every Friday evening." }],
    coverImage: "/images/Celestial Gemstone Temple Still Life.png", gallery: [],
    location: { mode: "temple", place: "Shri Mahalakshmi Temple", city: "Mumbai", state: "Maharashtra" },
    durationMin: 75, panditCount: 1, mantraCount: 108,
    packages: [
      { id: "single", name: "Individual", kind: "individual", members: 1, price: 1500, mrp: null, description: "Lakshmi pooja for one person.", perks: ["1 name", "Pooja video"] },
      { id: "couple", name: "Couple", kind: "couple", members: 2, price: 2100, mrp: 2500, description: "For husband and wife together.", perks: ["2 names", "Pooja video"], popular: true },
      { id: "business", name: "Business", kind: "family", members: 5, price: 3100, mrp: 3800, description: "For the owner, partners and the business name.", perks: ["Up to 5 names", "Business name in sankalp", "Pooja video"] },
    ],
    schedule: { mode: "weekly", weekdays: [5], times: ["18:30"], slotCapacity: 40, cutoffHours: 24, advanceDays: 60 },
    featured: true, sortOrder: 20,
  },
  {
    slug: "navagraha-shanti-pooja", title: "Navagraha Shanti Pooja", subtitle: "Peace with all nine planets",
    deity: "Navagraha", category: "graha_shanti", tags: ["navagraha", "graha shanti", "shani", "rahu", "ketu"],
    shortDescription: "Havan and mantra jaap for all nine planets to reduce malefic effects in your birth chart and bring balance in life.",
    description: "When planets are weak or placed badly in a birth chart, they can bring delays, health issues and stress. Navagraha Shanti pacifies all nine planets together: Surya, Chandra, Mangal, Budh, Guru, Shukra, Shani, Rahu and Ketu.\n\nEach graha gets its own mantra jaap, offering and samidha in the havan.",
    benefits: ["Reduces malefic planetary effects", "Helps during Sade Sati and difficult dashas", "Brings balance in health, career and relationships"],
    vidhi: ["Sankalp with name, gotra and birth details", "Navagraha mandal sthapana", "Mantra jaap for each of the nine planets", "Navagraha havan with specific samidha", "Purnahuti and aarti"],
    includes: ["Sankalp with your birth details", "Havan by 3 pandits", "Pooja video", "Remedy guidance after the pooja"],
    faqs: [{ q: "Do I need my birth time?", a: "It helps the pandit, but the pooja can be done with your name and date of birth." }],
    coverImage: "/images/vedic-gemstone-astrology.png", gallery: [],
    location: { mode: "our_pandits", place: "", city: "Haridwar", state: "Uttarakhand" },
    durationMin: 150, panditCount: 3, mantraCount: 9000,
    packages: [
      { id: "single", name: "Individual", kind: "individual", members: 1, price: 2100, mrp: 2700, description: "Navagraha shanti for one person.", perks: ["Birth details in sankalp", "Pooja video"], popular: true },
      { id: "family", name: "Family", kind: "family", members: 4, price: 3500, mrp: 4500, description: "For up to 4 family members.", perks: ["Up to 4 names", "Pooja video"] },
    ],
    schedule: { mode: "weekly", weekdays: [0, 6], times: ["07:30"], slotCapacity: 30, cutoffHours: 24, advanceDays: 60 },
    featured: false, sortOrder: 30,
  },
  {
    slug: "mangal-dosh-nivaran-pooja-ujjain", title: "Mangal Dosh Nivaran Pooja", subtitle: "For delays in marriage and harmony after marriage",
    deity: "Lord Mangal", category: "dosh_nivaran", tags: ["mangal dosh", "manglik", "marriage", "ujjain", "tuesday"],
    shortDescription: "Bhaat pooja and Mangal mantra jaap at the Mangalnath temple, Ujjain, to calm Mangal dosh for marriage and relationships.",
    description: "Mangalnath temple in Ujjain is believed to be the birthplace of Mars. Mangal dosh nivaran pooja here is done with bhaat (cooked rice) offering on the Shivling and Mangal mantra jaap.\n\nIt is done for people who are manglik, face delays in marriage, or have frequent conflicts after marriage.",
    benefits: ["Helps with delays in marriage", "Reduces conflicts between partners", "Calms anger and impulsive decisions"],
    vidhi: ["Sankalp with name and gotra", "Mangal dev pujan with red flowers and masoor dal", "Bhaat pooja on the Shivling", "Mangal beej mantra jaap", "Aarti and prasad"],
    includes: ["Pooja at Mangalnath temple", "Sankalp in your name", "Pooja video"],
    faqs: [{ q: "Can both partners be included?", a: "Yes. Choose the Couple package to include both names." }],
    coverImage: "/images/image3.png", gallery: [],
    location: { mode: "temple", place: "Mangalnath Temple", city: "Ujjain", state: "Madhya Pradesh" },
    durationMin: 60, panditCount: 1, mantraCount: 1008,
    packages: [
      { id: "single", name: "Individual", kind: "individual", members: 1, price: 1800, mrp: 2200, description: "For one person.", perks: ["1 name", "Pooja video"] },
      { id: "couple", name: "Couple", kind: "couple", members: 2, price: 2700, mrp: 3300, description: "For both partners or would-be partners.", perks: ["2 names", "Pooja video"], popular: true },
    ],
    schedule: { mode: "weekly", weekdays: [2], times: ["08:00"], slotCapacity: 25, cutoffHours: 24, advanceDays: 45 },
    featured: false, sortOrder: 40,
  },
  {
    slug: "satyanarayan-katha", title: "Satyanarayan Katha & Pooja", subtitle: "For blessings on any auspicious occasion",
    deity: "Lord Vishnu", category: "festival", tags: ["satyanarayan", "vishnu", "katha", "griha pravesh", "purnima"],
    shortDescription: "Satyanarayan vrat katha with full pooja vidhi, done for griha pravesh, birthdays, anniversaries and new beginnings.",
    description: "Satyanarayan pooja is performed to thank Lord Vishnu and seek blessings for the family. The five chapters of the katha are recited, followed by aarti and panchamrit prasad.\n\nPick any day that suits you. Our pandits perform it on the chosen date with your family names in the sankalp.",
    benefits: ["Blessings for a new home, job or venture", "Peace and happiness in the family", "Fulfilment of wishes"],
    vidhi: ["Sankalp and Ganesh pujan", "Navagraha and Kalash pujan", "Satyanarayan pujan with tulsi and panchamrit", "Recitation of the five chapters of the katha", "Havan, aarti and prasad"],
    includes: ["Full katha by our pandit", "Sankalp with family names", "Pooja video"],
    faqs: [{ q: "Can I choose any date?", a: "Yes. This pooja can be booked for any day within the next two months." }],
    coverImage: "/images/image2.png", gallery: [],
    location: { mode: "our_pandits", place: "", city: "Mathura", state: "Uttar Pradesh" },
    durationMin: 120, panditCount: 1, mantraCount: 0,
    packages: [
      { id: "family", name: "Family", kind: "family", members: 6, price: 2500, mrp: 3100, description: "For the whole family, up to 6 names.", perks: ["Up to 6 names", "Pooja video", "Any date"], popular: true },
    ],
    schedule: { mode: "on_request", slotCapacity: 10, cutoffHours: 48, advanceDays: 60 },
    featured: false, sortOrder: 50,
  },
];

async function main() {
  const { poojaService, poojaCategoryService, poojaInputSchema, blankPolicy, blankSankalp } = await import("../src/modules/poojas");
  const actor = { name: "Seed script" };
  const source = process.env.DATA_SOURCE_POOJAS || process.env.DATA_SOURCE || "mock";
  console.log(`Seeding poojas into: ${source}${source === "mongo" ? "" : "  (not saved to a database; set DATA_SOURCE_POOJAS=mongo)"}`);

  // Listing seeds the default categories on first use.
  const cats = await poojaCategoryService.list();
  const keys = new Set(cats.map((c) => c.key));
  let added = 0, skipped = 0, failed = 0;

  for (const s of SEEDS) {
    const category = keys.has(s.category) ? s.category : cats[0]?.key;
    if (!category) { console.log(`✗ ${s.title}: no pooja categories exist`); failed++; continue; }
    const input = poojaInputSchema.safeParse({
      ...s,
      category,
      videoUrl: "",
      location: { ...s.location, mapUrl: "" },
      packages: s.packages.map((p) => ({ ...p, popular: Boolean(p.popular), active: true })),
      addOns: s.location.mode === "temple" ? [prasad, recording, daan] : [prasad, recording],
      schedule: { weekdays: [], times: [], fixedDates: [], blackoutDates: [], ...s.schedule },
      policy: blankPolicy(),
      sankalp: { ...blankSankalp(), requireDob: s.category === "graha_shanti", instructions: "Write names exactly as you want them spoken in the sankalp." },
      seo: { title: `${s.title} Online Booking`.slice(0, 70), description: s.shortDescription.slice(0, 170) },
      status: "active",
    });
    if (!input.success) {
      console.log(`✗ ${s.title}: ${input.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
      failed++;
      continue;
    }
    const r = await poojaService.create(input.data, actor);
    if (r.ok) { console.log(`✓ added   ${r.value.title}  →  /pooja/${r.value.slug}`); added++; }
    else if (r.error.code === "CONFLICT") { console.log(`• skipped ${s.title} (already exists)`); skipped++; }
    else { console.log(`✗ ${s.title}: ${r.error.message}`); failed++; }
  }

  console.log(`\nDone: ${added} added, ${skipped} skipped, ${failed} failed.`);
  if (source === "mongo") (await import("mongoose")).default.disconnect().catch(() => {});
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
