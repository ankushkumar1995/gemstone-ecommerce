import type { Planet, ZodiacSign } from "@/types";

/**
 * Navagraha — the nine planets of Vedic astrology, each mapped to its
 * primary gemstone. Used by the "Shop by Planet" homepage section and can
 * later power planet-based filtering on the shop page.
 */
export interface PlanetInfo {
  key: Planet;
  name: string; // English
  sanskrit: string; // Devanagari / Hindi name
  stone: string; // primary gemstone
  stoneHindi: string; // gemstone's Indian name
  benefit: string;
  accent: string; // hex used for theming
  image: string; // HD stone image
  productSlug: string; // link target on the shop/product
  /** representative zodiac sign to deep-link into the shop filter */
  zodiac: ZodiacSign;
}

export const planets: PlanetInfo[] = [
  {
    key: "Sun",
    name: "Sun",
    sanskrit: "सूर्य (Surya)",
    stone: "Ruby",
    stoneHindi: "Manik",
    benefit: "Confidence, vitality & leadership",
    accent: "#ff4d6d",
    image:
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80",
    productSlug: "royal-ruby-signet-ring",
    zodiac: "leo",
  },
  {
    key: "Moon",
    name: "Moon",
    sanskrit: "चंद्र (Chandra)",
    stone: "Pearl",
    stoneHindi: "Moti",
    benefit: "Calm, emotional balance & harmony",
    accent: "#cbd5e1",
    image:
      "https://images.unsplash.com/photo-1535556116002-6281ff3e9f36?auto=format&fit=crop&w=800&q=80",
    productSlug: "pearl-moon-pendant",
    zodiac: "cancer",
  },
  {
    key: "Mars",
    name: "Mars",
    sanskrit: "मंगल (Mangal)",
    stone: "Red Coral",
    stoneHindi: "Moonga",
    benefit: "Courage, energy & protection",
    accent: "#ef4444",
    image:
      "https://images.unsplash.com/photo-1589674781759-c21c37956a44?auto=format&fit=crop&w=800&q=80",
    productSlug: "red-coral-power-ring",
    zodiac: "aries",
  },
  {
    key: "Mercury",
    name: "Mercury",
    sanskrit: "बुध (Budh)",
    stone: "Emerald",
    stoneHindi: "Panna",
    benefit: "Intellect, communication & business luck",
    accent: "#10b981",
    image:
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=800&q=80",
    productSlug: "emerald-vine-pendant",
    zodiac: "gemini",
  },
  {
    key: "Jupiter",
    name: "Jupiter",
    sanskrit: "गुरु (Guru)",
    stone: "Yellow Sapphire",
    stoneHindi: "Pukhraj",
    benefit: "Wisdom, prosperity & good fortune",
    accent: "#fbbf24",
    image:
      "https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&w=800&q=80",
    productSlug: "yellow-sapphire-blessing-ring",
    zodiac: "sagittarius",
  },
  {
    key: "Venus",
    name: "Venus",
    sanskrit: "शुक्र (Shukra)",
    stone: "Diamond",
    stoneHindi: "Heera",
    benefit: "Love, luxury & charm",
    accent: "#93c5fd",
    image:
      "https://images.unsplash.com/photo-1584302179602-e4c3d3fd629d?auto=format&fit=crop&w=800&q=80",
    productSlug: "diamond-aura-pendant",
    zodiac: "taurus",
  },
  {
    key: "Saturn",
    name: "Saturn",
    sanskrit: "शनि (Shani)",
    stone: "Blue Sapphire",
    stoneHindi: "Neelam",
    benefit: "Discipline, fortune & protection",
    accent: "#3b82f6",
    image:
      "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=800&q=80",
    productSlug: "celestial-blue-sapphire-ring",
    zodiac: "capricorn",
  },
  {
    key: "Rahu",
    name: "Rahu",
    sanskrit: "राहु (Rahu)",
    stone: "Hessonite",
    stoneHindi: "Gomed",
    benefit: "Clarity, success & protection from negativity",
    accent: "#a855f7",
    image:
      "https://images.unsplash.com/photo-1611085583191-a3b181a88401?auto=format&fit=crop&w=800&q=80",
    productSlug: "amethyst-serenity-bracelet",
    zodiac: "aquarius",
  },
  {
    key: "Ketu",
    name: "Ketu",
    sanskrit: "केतु (Ketu)",
    stone: "Cat's Eye",
    stoneHindi: "Lehsunia",
    benefit: "Intuition, moksha & spiritual growth",
    accent: "#f59e0b",
    image:
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80",
    productSlug: "citrine-abundance-bracelet",
    zodiac: "pisces",
  },
];
