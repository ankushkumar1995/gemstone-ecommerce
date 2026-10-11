import type { Product } from "@/types";

/**
 * Mock product catalogue. The shape mirrors what a real API would return,
 * so the data layer functions below can later be swapped for `fetch` calls
 * without touching any UI component.
 */
export const products: Product[] = [
  {
    id: "p1",
    slug: "royal-ruby-signet-ring",
    name: "Royal Ruby Signet Ring",
    category: "rings",
    price: 42999,
    mrp: 54999,
    rating: 4.9,
    reviews: 214,
    image:
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80",
    gradient: "linear-gradient(135deg, #ff4d6d 0%, #7a0b2b 55%, #2b0410 120%)",
    zodiac: ["leo", "aries", "scorpio"],
    badge: "Bestseller",
    shortDescription:
      "A fiery natural ruby set in 22k gold — the stone of the Sun, worn for vitality and leadership.",
    attributes: {
      stone: "Natural Ruby (Manik)",
      planet: "Sun",
      benefits: ["Confidence & authority", "Vitality", "Career growth"],
      origin: "Burma (Mozambique cut)",
      weightCarat: 5.25,
      certification: "IGI Certified",
      color: "Pigeon Blood Red",
    },
    inStock: true,
  },
  {
    id: "p2",
    slug: "celestial-blue-sapphire-ring",
    name: "Celestial Blue Sapphire Ring",
    category: "rings",
    price: 68999,
    mrp: 84999,
    rating: 4.8,
    reviews: 168,
    image:
      "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=900&q=80",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #1e3a8a 55%, #0a1026 120%)",
    zodiac: ["capricorn", "aquarius"],
    badge: "Certified",
    shortDescription:
      "The powerful Neelam of Saturn — fastest-acting gem for sudden fortune and discipline.",
    attributes: {
      stone: "Blue Sapphire (Neelam)",
      planet: "Saturn",
      benefits: ["Rapid prosperity", "Focus & discipline", "Protection"],
      origin: "Ceylon (Sri Lanka)",
      weightCarat: 4.75,
      certification: "GIA Certified",
      color: "Royal Cornflower Blue",
    },
    inStock: true,
  },
  {
    id: "p3",
    slug: "emerald-vine-pendant",
    name: "Emerald Vine Pendant",
    category: "pendants",
    price: 35999,
    mrp: 45999,
    rating: 4.7,
    reviews: 142,
    image:
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=80",
    gradient: "linear-gradient(135deg, #10b981 0%, #065f46 55%, #022c22 120%)",
    zodiac: ["gemini", "virgo"],
    badge: "New",
    shortDescription:
      "Lush natural emerald of Mercury, set in a hand-carved vine of white gold.",
    attributes: {
      stone: "Emerald (Panna)",
      planet: "Mercury",
      benefits: ["Sharp intellect", "Communication", "Business luck"],
      origin: "Colombia",
      weightCarat: 3.5,
      certification: "IGI Certified",
      color: "Vivid Green",
    },
    inStock: true,
  },
  {
    id: "p4",
    slug: "pearl-moon-pendant",
    name: "Pearl Moon Pendant",
    category: "pendants",
    price: 18999,
    mrp: 24999,
    rating: 4.6,
    reviews: 98,
    image:
      "https://images.unsplash.com/photo-1535556116002-6281ff3e9f36?auto=format&fit=crop&w=900&q=80",
    gradient: "linear-gradient(135deg, #e5e7eb 0%, #9ca3af 55%, #4b5563 120%)",
    zodiac: ["cancer"],
    shortDescription:
      "A luminous South Sea pearl of the Moon — calming, nurturing and emotionally grounding.",
    attributes: {
      stone: "Natural Pearl (Moti)",
      planet: "Moon",
      benefits: ["Emotional calm", "Better sleep", "Harmony"],
      origin: "South Sea",
      weightCarat: 6.0,
      certification: "Lab Certified",
      color: "Lustrous White",
    },
    inStock: true,
  },
  {
    id: "p5",
    slug: "yellow-sapphire-blessing-ring",
    name: "Yellow Sapphire Blessing Ring",
    category: "rings",
    price: 51999,
    mrp: 63999,
    rating: 4.9,
    reviews: 187,
    image:
      "https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&w=900&q=80",
    gradient: "linear-gradient(135deg, #fbbf24 0%, #b45309 55%, #3b1d05 120%)",
    zodiac: ["sagittarius", "pisces"],
    badge: "Bestseller",
    shortDescription:
      "Pukhraj of Jupiter — the gem of wisdom, prosperity and auspicious new beginnings.",
    attributes: {
      stone: "Yellow Sapphire (Pukhraj)",
      planet: "Jupiter",
      benefits: ["Wealth & wisdom", "Marital harmony", "Good fortune"],
      origin: "Ceylon (Sri Lanka)",
      weightCarat: 5.0,
      certification: "GIA Certified",
      color: "Golden Yellow",
    },
    inStock: true,
  },
  {
    id: "p6",
    slug: "red-coral-power-ring",
    name: "Red Coral Power Ring",
    category: "rings",
    price: 15999,
    mrp: 21999,
    rating: 4.5,
    reviews: 76,
    image:
      "https://images.unsplash.com/photo-1589674781759-c21c37956a44?auto=format&fit=crop&w=900&q=80",
    gradient: "linear-gradient(135deg, #ef4444 0%, #991b1b 55%, #450a0a 120%)",
    zodiac: ["aries", "scorpio"],
    shortDescription:
      "Moonga of Mars — bold energy, courage and protection against adversity.",
    attributes: {
      stone: "Red Coral (Moonga)",
      planet: "Mars",
      benefits: ["Courage & drive", "Energy", "Protection"],
      origin: "Italy (Mediterranean)",
      weightCarat: 7.25,
      certification: "Lab Certified",
      color: "Deep Ox-Blood Red",
    },
    inStock: true,
  },
  {
    id: "p7",
    slug: "amethyst-serenity-bracelet",
    name: "Amethyst Serenity Bracelet",
    category: "bracelets",
    price: 4999,
    mrp: 7999,
    rating: 4.7,
    reviews: 231,
    image:
      "https://images.unsplash.com/photo-1611085583191-a3b181a88401?auto=format&fit=crop&w=900&q=80",
    gradient: "linear-gradient(135deg, #a855f7 0%, #6b21a8 55%, #2e1065 120%)",
    zodiac: ["aquarius", "pisces", "capricorn"],
    badge: "Bestseller",
    shortDescription:
      "Hand-knotted amethyst beads for calm, clarity and spiritual protection.",
    attributes: {
      stone: "Natural Amethyst",
      planet: "Saturn",
      benefits: ["Stress relief", "Clarity", "Spiritual balance"],
      origin: "Brazil",
      weightCarat: 60,
      certification: "Lab Certified",
      color: "Deep Violet",
    },
    inStock: true,
  },
  {
    id: "p8",
    slug: "citrine-abundance-bracelet",
    name: "Citrine Abundance Bracelet",
    category: "bracelets",
    price: 3999,
    mrp: 5999,
    rating: 4.6,
    reviews: 189,
    image:
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #b45309 55%, #451a03 120%)",
    zodiac: ["leo", "sagittarius"],
    badge: "New",
    shortDescription:
      "The merchant's stone — citrine beads believed to attract wealth and positivity.",
    attributes: {
      stone: "Natural Citrine",
      planet: "Jupiter",
      benefits: ["Abundance", "Positivity", "Confidence"],
      origin: "Brazil",
      weightCarat: 55,
      certification: "Lab Certified",
      color: "Golden Amber",
    },
    inStock: true,
  },
  {
    id: "p9",
    slug: "certified-emerald-loose-stone",
    name: "Certified Emerald — Loose",
    category: "loose-stones",
    price: 28999,
    mrp: 36999,
    rating: 4.8,
    reviews: 54,
    image:
      "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=900&q=80",
    gradient: "linear-gradient(135deg, #059669 0%, #064e3b 55%, #022c22 120%)",
    zodiac: ["gemini", "virgo"],
    badge: "Certified",
    shortDescription:
      "A ready-to-set natural Colombian emerald with full lab certification.",
    attributes: {
      stone: "Emerald (Panna)",
      planet: "Mercury",
      benefits: ["Intellect", "Communication", "Prosperity"],
      origin: "Colombia",
      weightCarat: 4.25,
      certification: "IGI Certified",
      color: "Vivid Green",
    },
    inStock: true,
  },
  {
    id: "p10",
    slug: "blue-sapphire-loose-stone",
    name: "Blue Sapphire — Loose",
    category: "loose-stones",
    price: 44999,
    mrp: 55999,
    rating: 4.9,
    reviews: 41,
    image:
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80&sat=-30",
    gradient: "linear-gradient(135deg, #2563eb 0%, #1e3a8a 55%, #0a1026 120%)",
    zodiac: ["capricorn", "aquarius"],
    badge: "Limited",
    shortDescription:
      "Unheated Ceylon blue sapphire — a rare, investment-grade loose stone.",
    attributes: {
      stone: "Blue Sapphire (Neelam)",
      planet: "Saturn",
      benefits: ["Fortune", "Discipline", "Protection"],
      origin: "Ceylon (Sri Lanka)",
      weightCarat: 5.5,
      certification: "GIA Certified",
      color: "Cornflower Blue",
    },
    inStock: false,
  },
  {
    id: "p11",
    slug: "5-mukhi-rudraksha-mala",
    name: "5 Mukhi Rudraksha Mala",
    category: "rudraksha",
    price: 2499,
    mrp: 3999,
    rating: 4.8,
    reviews: 312,
    image:
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=80",
    gradient: "linear-gradient(135deg, #92400e 0%, #451a03 55%, #1c0a01 120%)",
    zodiac: ["sagittarius", "pisces", "cancer"],
    badge: "Bestseller",
    shortDescription:
      "Authentic 108-bead 5 Mukhi Rudraksha mala for meditation and peace.",
    attributes: {
      stone: "5 Mukhi Rudraksha",
      planet: "Jupiter",
      benefits: ["Peace of mind", "Meditation", "Protection"],
      origin: "Nepal",
      weightCarat: 108,
      certification: "Lab Certified",
      color: "Natural Brown",
    },
    inStock: true,
  },
  {
    id: "p12",
    slug: "diamond-aura-pendant",
    name: "Diamond Aura Pendant",
    category: "pendants",
    price: 89999,
    mrp: 109999,
    rating: 5.0,
    reviews: 63,
    image:
      "https://images.unsplash.com/photo-1584302179602-e4c3d3fd629d?auto=format&fit=crop&w=900&q=80",
    gradient: "linear-gradient(135deg, #e0f2fe 0%, #93c5fd 45%, #6366f1 120%)",
    zodiac: ["taurus", "libra"],
    badge: "Limited",
    shortDescription:
      "Brilliant-cut natural diamond of Venus — the ultimate symbol of love and luxury.",
    attributes: {
      stone: "Natural Diamond (Heera)",
      planet: "Venus",
      benefits: ["Luxury & charm", "Love", "Prosperity"],
      origin: "South Africa",
      weightCarat: 1.2,
      certification: "GIA Certified",
      color: "Colourless (D)",
    },
    inStock: true,
  },
];

/* ------------------------------------------------------------------ *
 * Data access helpers — mirror a future async API surface.
 * ------------------------------------------------------------------ */

export function getAllProducts(): Product[] {
  return products;
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(category: string): Product[] {
  return products.filter((p) => p.category === category);
}

export function getProductsByZodiac(sign: string): Product[] {
  return products.filter((p) =>
    p.zodiac.includes(sign as Product["zodiac"][number])
  );
}

export function getBestsellers(): Product[] {
  return products.filter((p) => p.badge === "Bestseller");
}

export function getFeatured(limit = 8): Product[] {
  return [...products].sort((a, b) => b.rating - a.rating).slice(0, limit);
}

export function getRelatedProducts(slug: string, limit = 4): Product[] {
  const current = getProductBySlug(slug);
  if (!current) return products.slice(0, limit);
  return products
    .filter((p) => p.slug !== slug && p.category === current.category)
    .slice(0, limit);
}
