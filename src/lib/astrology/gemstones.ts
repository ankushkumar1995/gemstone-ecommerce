/**
 * Gemstone astrology reference data.
 *
 * Maps the nine planets (Navagraha) to their primary Vedic gemstone, and each
 * rashi (Moon sign) to the stone most commonly recommended for it via its
 * ruling planet. Used by the Gemstone Recommendation + "gemstone by zodiac"
 * tools to turn a chart/sign into a concrete, shoppable suggestion.
 *
 * `shopCategory` / `shopQuery` point at the storefront so each recommendation
 * links straight to products.
 */

export interface PlanetGem {
  planet: string;
  gem: string; // English name
  hindi: string; // common Hindi/trade name
  finger: string;
  metal: string;
  day: string; // day to wear
  mantra: string;
  benefits: string;
  /** storefront search term to link to matching products */
  shopQuery: string;
}

/** Primary gemstone per planet. */
export const PLANET_GEMS: Record<string, PlanetGem> = {
  Sun: {
    planet: "Sun (Surya)",
    gem: "Ruby",
    hindi: "Manik",
    finger: "Ring finger",
    metal: "Gold",
    day: "Sunday",
    mantra: "Om Suryaya Namaha",
    benefits: "Confidence, leadership, vitality, authority and success in career.",
    shopQuery: "ruby",
  },
  Moon: {
    planet: "Moon (Chandra)",
    gem: "Pearl",
    hindi: "Moti",
    finger: "Little finger",
    metal: "Silver",
    day: "Monday",
    mantra: "Om Chandraya Namaha",
    benefits: "Calm mind, emotional balance, better sleep and mental peace.",
    shopQuery: "pearl",
  },
  Mars: {
    planet: "Mars (Mangal)",
    gem: "Red Coral",
    hindi: "Moonga",
    finger: "Ring finger",
    metal: "Gold or Copper",
    day: "Tuesday",
    mantra: "Om Mangalaya Namaha",
    benefits: "Courage, energy, drive and protection from enemies and debt.",
    shopQuery: "coral",
  },
  Mercury: {
    planet: "Mercury (Budh)",
    gem: "Emerald",
    hindi: "Panna",
    finger: "Little finger",
    metal: "Gold",
    day: "Wednesday",
    mantra: "Om Budhaya Namaha",
    benefits: "Intelligence, communication, business skills and clarity of thought.",
    shopQuery: "emerald",
  },
  Jupiter: {
    planet: "Jupiter (Guru)",
    gem: "Yellow Sapphire",
    hindi: "Pukhraj",
    finger: "Index finger",
    metal: "Gold",
    day: "Thursday",
    mantra: "Om Gurave Namaha",
    benefits: "Wisdom, wealth, marriage, prosperity and good fortune.",
    shopQuery: "yellow sapphire",
  },
  Venus: {
    planet: "Venus (Shukra)",
    gem: "Diamond",
    hindi: "Heera",
    finger: "Middle or little finger",
    metal: "Platinum or Silver",
    day: "Friday",
    mantra: "Om Shukraya Namaha",
    benefits: "Love, luxury, beauty, relationships and artistic success.",
    shopQuery: "diamond",
  },
  Saturn: {
    planet: "Saturn (Shani)",
    gem: "Blue Sapphire",
    hindi: "Neelam",
    finger: "Middle finger",
    metal: "Silver or Panchdhatu",
    day: "Saturday",
    mantra: "Om Shanaye Namaha",
    benefits: "Discipline, career growth, relief from Sade Sati and sudden gains.",
    shopQuery: "blue sapphire",
  },
  Rahu: {
    planet: "Rahu",
    gem: "Hessonite",
    hindi: "Gomed",
    finger: "Middle finger",
    metal: "Silver or Panchdhatu",
    day: "Saturday",
    mantra: "Om Rahave Namaha",
    benefits: "Protection from confusion, hidden enemies and Rahu's ill effects.",
    shopQuery: "hessonite",
  },
  Ketu: {
    planet: "Ketu",
    gem: "Cat's Eye",
    hindi: "Lehsunia",
    finger: "Middle finger",
    metal: "Silver or Panchdhatu",
    day: "Saturday",
    mantra: "Om Ketave Namaha",
    benefits: "Spiritual growth, protection from accidents and sudden misfortune.",
    shopQuery: "cat eye",
  },
};

/** Ruling planet per rashi index (0=Aries … 11=Pisces). */
export const RASHI_RULER = [
  "Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury",
  "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter",
] as const;

/** Lucky gemstone for a rashi = the gemstone of its ruling planet. */
export function gemForRashi(rashiIndex: number): PlanetGem {
  return PLANET_GEMS[RASHI_RULER[rashiIndex]];
}

/**
 * Most auspicious ("yoga") gemstone for a chart.
 *
 * In Vedic astrology the lords of the trine houses (1, 5, 9) from the
 * Ascendant are the most benefic. The 5th and 9th lords in particular give
 * fortune, wisdom and success, so their gemstone is traditionally the most
 * recommended "lucky/benefic" stone. We take the 9th-house (Bhagya/fortune)
 * lord, falling back to the 5th if the 9th equals the Lagna lord.
 */
export function beneficGemForLagna(lagnaRashiIndex: number): { gem: PlanetGem; planet: string; house: number } {
  const lagnaLord = RASHI_RULER[lagnaRashiIndex];
  const ninthRashi = (lagnaRashiIndex + 8) % 12; // 9th house sign
  const fifthRashi = (lagnaRashiIndex + 4) % 12; // 5th house sign
  const ninthLord = RASHI_RULER[ninthRashi];
  const fifthLord = RASHI_RULER[fifthRashi];

  // Prefer the 9th (fortune) lord; if it's the same planet as the Lagna lord,
  // use the 5th (wisdom/purva-punya) lord for variety and strength.
  if (ninthLord !== lagnaLord) {
    return { gem: PLANET_GEMS[ninthLord], planet: ninthLord, house: 9 };
  }
  return { gem: PLANET_GEMS[fifthLord], planet: fifthLord, house: 5 };
}

/* ------------------------------------------------------------------ *
 * Rudraksha
 * ------------------------------------------------------------------ */

export interface Rudraksha {
  mukhi: string; // e.g. "5 Mukhi"
  deity: string;
  planet: string;
  benefits: string;
}

/** Rudraksha recommended per planet (common Vedic association). */
export const PLANET_RUDRAKSHA: Record<string, Rudraksha> = {
  Sun: { mukhi: "12 Mukhi", deity: "Surya", planet: "Sun", benefits: "Leadership, confidence and radiant health." },
  Moon: { mukhi: "2 Mukhi", deity: "Ardhanarishvara", planet: "Moon", benefits: "Emotional balance, harmony in relationships." },
  Mars: { mukhi: "3 Mukhi", deity: "Agni", planet: "Mars", benefits: "Courage, release of past guilt, vitality." },
  Mercury: { mukhi: "4 Mukhi", deity: "Brahma", planet: "Mercury", benefits: "Knowledge, communication and focus." },
  Jupiter: { mukhi: "5 Mukhi", deity: "Kalagni Rudra", planet: "Jupiter", benefits: "Peace, wisdom and overall wellbeing (most popular)." },
  Venus: { mukhi: "6 Mukhi", deity: "Kartikeya", planet: "Venus", benefits: "Charm, relationships and emotional strength." },
  Saturn: { mukhi: "7 Mukhi", deity: "Mahalakshmi", planet: "Saturn", benefits: "Wealth, relief from Saturn's hardships and Sade Sati." },
  Rahu: { mukhi: "8 Mukhi", deity: "Ganesha", planet: "Rahu", benefits: "Removes obstacles and protects from Rahu's effects." },
  Ketu: { mukhi: "9 Mukhi", deity: "Durga", planet: "Ketu", benefits: "Fearlessness, energy and spiritual protection." },
};
