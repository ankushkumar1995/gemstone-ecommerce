/**
 * Banners domain — repository. Mock in-memory store seeded with the current
 * homepage promo banner. Swap for Mongo later via getBannerRepository().
 */

import { env } from "@/core/config/env";
import type { Banner } from "./banner.types";

export interface BannerRepository {
  findAll(): Promise<Banner[]>;
  findById(id: string): Promise<Banner | null>;
  create(banner: Banner): Promise<Banner>;
  update(id: string, patch: Partial<Banner>): Promise<Banner | null>;
  remove(id: string): Promise<boolean>;
}

const store: Banner[] = [
  {
    id: "ban_promo_1",
    placement: "promo",
    eyebrow: "Stone of the Month",
    title: "Blue Sapphire — Neelam Festival",
    subtitle: "The fastest-acting gem of Saturn — up to 30% off certified, unheated Ceylon sapphires. Limited stock this season.",
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

const mockBannerRepository: BannerRepository = {
  async findAll() {
    return store.map((b) => ({ ...b }));
  },
  async findById(id) {
    const b = store.find((x) => x.id === id);
    return b ? { ...b } : null;
  },
  async create(banner) {
    store.unshift(banner);
    return { ...banner };
  },
  async update(id, patch) {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    store[idx] = { ...store[idx], ...patch };
    return { ...store[idx] };
  },
  async remove(id) {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return false;
    store.splice(idx, 1);
    return true;
  },
};

export function getBannerRepository(): BannerRepository {
  switch (env.DATA_SOURCE) {
    case "mongo":
      throw new Error("Mongo banner repository not implemented yet");
    case "mock":
    default:
      return mockBannerRepository;
  }
}
