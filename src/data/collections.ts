import type { Collection } from "@/types";

/**
 * Mock collections — dynamic, admin-managed storefront groupings (distinct
 * from the fixed `category` enum). Seeds the collections repository.
 */
export const collections: Collection[] = [
  {
    id: "col_sun",
    slug: "sun-gemstones",
    title: "Sun Gemstones",
    description: "Ruby & stones that channel the Sun — vitality, authority, leadership.",
    image:
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=80",
    featured: true,
    createdAt: "2026-01-10T09:00:00.000Z",
  },
  {
    id: "col_saturn",
    slug: "saturn-remedies",
    title: "Saturn Remedies",
    description: "Blue Sapphire & Amethyst for discipline, focus and sudden fortune.",
    image:
      "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=1200&q=80",
    featured: true,
    createdAt: "2026-01-12T09:00:00.000Z",
  },
  {
    id: "col_wedding",
    slug: "wedding-collection",
    title: "Wedding Collection",
    description: "Heirloom-grade certified stones for life's biggest moments.",
    image:
      "https://images.unsplash.com/photo-1535556116002-6281ff3e9f36?auto=format&fit=crop&w=1200&q=80",
    featured: false,
    createdAt: "2026-02-02T09:00:00.000Z",
  },
  {
    id: "col_budget",
    slug: "under-25k",
    title: "Under ₹25,000",
    description: "Certified, astrologically energised gems that don't break the bank.",
    featured: false,
    createdAt: "2026-02-20T09:00:00.000Z",
  },
];
