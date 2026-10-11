import type { Category } from "@/types";

export const categories: Category[] = [
  {
    id: "cat_rings",
    slug: "rings",
    title: "Gemstone Rings",
    tagline: "Astrologically energised, hand-set in gold & silver",
    image:
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=80",
    tint: "linear-gradient(135deg, rgba(122,69,245,0.35), rgba(21,15,50,0.1))",
    order: 1,
    createdAt: "2026-01-05T09:00:00.000Z",
  },
  {
    id: "cat_pendants",
    slug: "pendants",
    title: "Pendants & Lockets",
    tagline: "Carry your lucky stone close to the heart",
    image:
      "https://images.unsplash.com/photo-1611085583191-a3b181a88401?auto=format&fit=crop&w=1200&q=80",
    tint: "linear-gradient(135deg, rgba(34,211,238,0.3), rgba(21,15,50,0.1))",
    order: 2,
    createdAt: "2026-01-05T09:00:00.000Z",
  },
  {
    id: "cat_bracelets",
    slug: "bracelets",
    title: "Healing Bracelets",
    tagline: "Crystal & gemstone beads for daily balance",
    image:
      "https://images.unsplash.com/photo-1535556116002-6281ff3e9f36?auto=format&fit=crop&w=1200&q=80",
    tint: "linear-gradient(135deg, rgba(255,107,166,0.3), rgba(21,15,50,0.1))",
    order: 3,
    createdAt: "2026-01-05T09:00:00.000Z",
  },
  {
    id: "cat_loose",
    slug: "loose-stones",
    title: "Certified Loose Stones",
    tagline: "Lab-tested natural gems, ready to set",
    image:
      "https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&w=1200&q=80",
    tint: "linear-gradient(135deg, rgba(230,180,58,0.3), rgba(21,15,50,0.1))",
    order: 4,
    createdAt: "2026-01-05T09:00:00.000Z",
  },
  {
    id: "cat_rudraksha",
    slug: "rudraksha",
    title: "Rudraksha & Malas",
    tagline: "Sacred beads for meditation & protection",
    image:
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&q=80",
    tint: "linear-gradient(135deg, rgba(145,105,255,0.32), rgba(11,8,32,0.1))",
    order: 5,
    createdAt: "2026-01-05T09:00:00.000Z",
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
