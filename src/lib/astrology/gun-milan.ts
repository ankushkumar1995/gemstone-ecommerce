/**
 * Ashtakoot Gun Milan — the 8-fold Vedic compatibility system used for Kundli
 * Matching before marriage. It scores a couple out of 36 "gunas" across eight
 * kootas, each based on the bride's and groom's Moon Nakshatra (and the Rashi
 * it falls in):
 *
 *   1. Varna      (1)  — ego / spiritual compatibility
 *   2. Vashya     (2)  — mutual control / attraction
 *   3. Tara/Dina  (3)  — health & wellbeing (birth-star compatibility)
 *   4. Yoni       (4)  — physical / sexual compatibility
 *   5. Graha Maitri(5) — mental compatibility (moon-lord friendship)
 *   6. Gana       (6)  — temperament
 *   7. Bhakoot    (7)  — love, family welfare & finances
 *   8. Nadi       (8)  — health & progeny (most important)
 *
 * Total = 36. Conventionally 18+ is considered an acceptable match.
 *
 * Inputs are each partner's Moon nakshatra index (0–26) and Moon rashi index
 * (0–11), which we get from `computeKundli`.
 */

/* --------------------------- reference tables --------------------------- */

// Varna per rashi (0=Aries … 11=Pisces): Brahmin(4) > Kshatriya(3) > Vaishya(2) > Shudra(1)
// Water signs = Brahmin, Fire = Kshatriya, Earth = Vaishya, Air = Shudra.
const VARNA_BY_RASHI = [3, 2, 1, 4, 3, 2, 1, 4, 3, 2, 1, 4]; // rank 1..4

// Vashya groups per rashi.
const VASHYA_GROUP = [
  "Chatushpada", "Chatushpada", "Manav", "Jalchar", "Vanchar", "Manav",
  "Manav", "Keet", "Manav", "Jalchar", "Manav", "Jalchar",
] as const;

// Yoni (animal) per nakshatra (0–26).
const YONI = [
  "Horse", "Elephant", "Sheep", "Serpent", "Serpent", "Dog", "Cat", "Sheep",
  "Cat", "Rat", "Rat", "Cow", "Buffalo", "Tiger", "Buffalo", "Tiger", "Deer",
  "Deer", "Dog", "Monkey", "Mongoose", "Monkey", "Lion", "Horse", "Lion",
  "Cow", "Elephant",
] as const;

// Gana per nakshatra: Dev(0), Manushya(1), Rakshasa(2).
const GANA = [
  0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0,
];

// Nadi per nakshatra: Aadi(0), Madhya(1), Antya(2).
const NADI = [
  0, 1, 2, 0, 1, 2, 0, 1, 2, 2, 1, 0, 2, 1, 0, 0, 1, 2, 0, 1, 2, 2, 1, 0, 2, 1, 0,
];

// Rashi lord (planet) per rashi — for Graha Maitri.
const RASHI_LORD = [
  "Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury",
  "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter",
] as const;

// Planetary friendship for Graha Maitri (friend/neutral/enemy).
const FRIENDS: Record<string, string[]> = {
  Sun: ["Moon", "Mars", "Jupiter"],
  Moon: ["Sun", "Mercury"],
  Mars: ["Sun", "Moon", "Jupiter"],
  Mercury: ["Sun", "Venus"],
  Jupiter: ["Sun", "Moon", "Mars"],
  Venus: ["Mercury", "Saturn"],
  Saturn: ["Mercury", "Venus"],
};
const ENEMIES: Record<string, string[]> = {
  Sun: ["Venus", "Saturn"],
  Moon: [],
  Mars: ["Mercury"],
  Mercury: ["Moon"],
  Jupiter: ["Mercury", "Venus"],
  Venus: ["Sun", "Moon"],
  Saturn: ["Sun", "Moon", "Mars"],
};

// Yoni enemy pairs (0 points when enemies).
const YONI_ENEMIES: Record<string, string> = {
  Cat: "Rat", Rat: "Cat", Cow: "Tiger", Tiger: "Cow", Elephant: "Lion",
  Lion: "Elephant", Horse: "Buffalo", Buffalo: "Horse", Dog: "Deer",
  Deer: "Dog", Monkey: "Sheep", Sheep: "Monkey", Serpent: "Mongoose",
  Mongoose: "Serpent",
};

/* ------------------------------- types --------------------------------- */

export interface GunPartner {
  nakshatraIndex: number; // 0–26 (Moon nakshatra)
  rashiIndex: number; // 0–11 (Moon rashi)
}

export interface KootScore {
  name: string;
  got: number;
  max: number;
  note: string;
}

export interface GunMilanResult {
  total: number; // out of 36
  maxTotal: 36;
  koots: KootScore[];
  verdict: "excellent" | "good" | "average" | "not-recommended";
  summary: string;
  manglikNote: string;
}

/* ------------------------------ kootas --------------------------------- */

function varnaKoot(boy: GunPartner, girl: GunPartner): KootScore {
  const b = VARNA_BY_RASHI[boy.rashiIndex];
  const g = VARNA_BY_RASHI[girl.rashiIndex];
  // Point if boy's varna >= girl's varna.
  const got = b >= g ? 1 : 0;
  return { name: "Varna", got, max: 1, note: "Spiritual & ego compatibility" };
}

function vashyaKoot(boy: GunPartner, girl: GunPartner): KootScore {
  const gb = VASHYA_GROUP[boy.rashiIndex];
  const gg = VASHYA_GROUP[girl.rashiIndex];
  const got = gb === gg ? 2 : gb === "Manav" || gg === "Manav" ? 1 : 0;
  return { name: "Vashya", got, max: 2, note: "Mutual attraction & control" };
}

function taraKoot(boy: GunPartner, girl: GunPartner): KootScore {
  // Count nakshatras from one to the other, both ways; remainder mod 9.
  const countBG = ((girl.nakshatraIndex - boy.nakshatraIndex + 27) % 27) + 1;
  const countGB = ((boy.nakshatraIndex - girl.nakshatraIndex + 27) % 27) + 1;
  const rBG = countBG % 9;
  const rGB = countGB % 9;
  // Even remainder (0,2,4,6,8) is auspicious.
  const okBG = rBG % 2 === 0 ? 1 : 0;
  const okGB = rGB % 2 === 0 ? 1 : 0;
  const got = okBG && okGB ? 3 : okBG || okGB ? 1.5 : 0;
  return { name: "Tara (Dina)", got, max: 3, note: "Health & destiny" };
}

function yoniKoot(boy: GunPartner, girl: GunPartner): KootScore {
  const yb = YONI[boy.nakshatraIndex];
  const yg = YONI[girl.nakshatraIndex];
  let got: number;
  if (yb === yg) got = 4;
  else if (YONI_ENEMIES[yb] === yg) got = 0;
  else got = 2; // friendly/neutral (simplified)
  return { name: "Yoni", got, max: 4, note: "Physical compatibility" };
}

function grahaMaitriKoot(boy: GunPartner, girl: GunPartner): KootScore {
  const lb = RASHI_LORD[boy.rashiIndex];
  const lg = RASHI_LORD[girl.rashiIndex];
  let got: number;
  if (lb === lg) got = 5;
  else {
    const bFriend = FRIENDS[lb]?.includes(lg);
    const gFriend = FRIENDS[lg]?.includes(lb);
    const bEnemy = ENEMIES[lb]?.includes(lg);
    const gEnemy = ENEMIES[lg]?.includes(lb);
    if (bFriend && gFriend) got = 5;
    else if ((bFriend || gFriend) && !(bEnemy || gEnemy)) got = 4;
    else if (!bEnemy && !gEnemy) got = 3;
    else if ((bFriend && gEnemy) || (gFriend && bEnemy)) got = 1;
    else got = 0;
  }
  return { name: "Graha Maitri", got, max: 5, note: "Mental compatibility" };
}

function ganaKoot(boy: GunPartner, girl: GunPartner): KootScore {
  const gb = GANA[boy.nakshatraIndex]; // 0 Dev, 1 Manushya, 2 Rakshasa
  const gg = GANA[girl.nakshatraIndex];
  let got: number;
  if (gb === gg) got = 6;
  else if ((gb === 0 && gg === 1) || (gb === 1 && gg === 0)) got = 5; // Dev-Manushya
  else if ((gb === 1 && gg === 2) || (gb === 2 && gg === 1)) got = 1; // Manushya-Rakshasa
  else if (gb === 0 && gg === 2) got = 1; // boy Dev, girl Rakshasa
  else got = 0; // boy Rakshasa, girl Dev — least favourable
  return { name: "Gana", got, max: 6, note: "Temperament" };
}

function bhakootKoot(boy: GunPartner, girl: GunPartner): KootScore {
  const diff = ((girl.rashiIndex - boy.rashiIndex + 12) % 12) + 1; // 1..12
  // Inauspicious combos: 6/8 (shadashtak) and 2/12, 5/9 (nav-pancham).
  const bad = [2, 5, 6, 8, 9, 12];
  // distance both ways
  const d1 = diff;
  const d2 = ((boy.rashiIndex - girl.rashiIndex + 12) % 12) + 1;
  const got = bad.includes(d1) || bad.includes(d2) ? 0 : 7;
  return { name: "Bhakoot", got, max: 7, note: "Love, family & finances" };
}

function nadiKoot(boy: GunPartner, girl: GunPartner): KootScore {
  const nb = NADI[boy.nakshatraIndex];
  const ng = NADI[girl.nakshatraIndex];
  // Same Nadi = 0 (Nadi dosha); different = 8.
  const got = nb === ng ? 0 : 8;
  return { name: "Nadi", got, max: 8, note: "Health & progeny (most vital)" };
}

/* ------------------------------- main ---------------------------------- */

export function computeGunMilan(boy: GunPartner, girl: GunPartner): GunMilanResult {
  const koots = [
    varnaKoot(boy, girl),
    vashyaKoot(boy, girl),
    taraKoot(boy, girl),
    yoniKoot(boy, girl),
    grahaMaitriKoot(boy, girl),
    ganaKoot(boy, girl),
    bhakootKoot(boy, girl),
    nadiKoot(boy, girl),
  ];
  const total = Math.round(koots.reduce((s, k) => s + k.got, 0) * 10) / 10;

  let verdict: GunMilanResult["verdict"];
  let summary: string;
  if (total >= 28) {
    verdict = "excellent";
    summary =
      "An excellent match. The horoscopes are highly compatible across the key kootas, indicating a harmonious and lasting union.";
  } else if (total >= 18) {
    verdict = "good";
    summary =
      "A good, recommended match. The couple scores above the traditional threshold of 18 gunas, suggesting a compatible and supportive marriage.";
  } else if (total >= 12) {
    verdict = "average";
    summary =
      "An average match. The score falls below the ideal 18 gunas. A detailed consultation is recommended to review doshas and remedies before proceeding.";
  } else {
    verdict = "not-recommended";
    summary =
      "A low score. This match is traditionally not recommended without an expert astrologer's review of doshas and possible remedies.";
  }

  const nadi = koots.find((k) => k.name === "Nadi")!;
  const bhakoot = koots.find((k) => k.name === "Bhakoot")!;
  const doshas: string[] = [];
  if (nadi.got === 0) doshas.push("Nadi Dosha");
  if (bhakoot.got === 0) doshas.push("Bhakoot Dosha");
  const manglikNote = doshas.length
    ? `Note: ${doshas.join(" and ")} detected. These can often be remedied — a personalised consultation is advised.`
    : "No major Nadi or Bhakoot dosha detected in the Ashtakoot analysis.";

  return { total, maxTotal: 36, koots, verdict, summary, manglikNote };
}
