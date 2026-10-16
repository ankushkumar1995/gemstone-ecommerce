import type { Banner } from "@/modules/banners/banner.types";

/** Mock banner seed. Also loaded into Mongo by the seed script. */

export const banners: Banner[] = [
  {
    id: "ban_promo_1",
    placement: "promo",
    eyebrow: "Stone of the Month",
    title: "Blue Sapphire — Neelam Festival",
    subtitle:
      "The fastest-acting gem of Saturn — up to 30% off certified, unheated Ceylon sapphires. Limited stock this season.",
    image:
      "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=2000&q=85",
    ctaLabel: "Shop the Offer",
    ctaHref: "/shop?category=loose-stones",
    order: 1,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "ban_hero_1",
    placement: "hero",
    eyebrow: "New Arrivals",
    title: "Certified Ruby Collection",
    subtitle: "Hand-picked, lab-certified rubies for vitality and leadership.",
    image:
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=2000&q=85",
    ctaLabel: "Explore Rubies",
    ctaHref: "/shop?category=rings",
    order: 1,
    active: true,
    createdAt: new Date().toISOString(),
  },
];
