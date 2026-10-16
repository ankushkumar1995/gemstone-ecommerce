/**
 * Pages (CMS) domain — repository. Mock in-memory store seeded with a couple
 * of starter pages. Swap for Mongo later via getPageRepository().
 */

import { env } from "@/core/config/env";
import type { CmsPage } from "./page.types";

export interface PageRepository {
  findAll(): Promise<CmsPage[]>;
  findById(id: string): Promise<CmsPage | null>;
  findBySlug(slug: string): Promise<CmsPage | null>;
  create(page: CmsPage): Promise<CmsPage>;
  update(id: string, patch: Partial<CmsPage>): Promise<CmsPage | null>;
  remove(id: string): Promise<boolean>;
}

const now = new Date().toISOString();

const store: CmsPage[] = [
  {
    id: "page_about",
    slug: "about-us",
    title: "About Us",
    content:
      "<h2>Our Story</h2><p>Astrounkle began with a simple belief — that every gemstone carries a story and an energy. For over a decade we have sourced certified, natural stones and energised them with authentic Vedic rituals.</p><p>Today we serve thousands of customers across India and beyond, pairing gemmological rigour with astrological wisdom.</p>",
    status: "published",
    seoTitle: "About Astrounkle — Certified Gemstone Experts",
    seoDescription: "Learn about Astrounkle's decade-long journey sourcing and energising certified natural gemstones.",
    showInFooter: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "page_shipping",
    slug: "shipping-policy",
    title: "Shipping Policy",
    content:
      "<h2>Shipping</h2><p>Orders are dispatched within 2–3 business days after the stone is certified and energised. Free shipping applies above the configured threshold.</p><ul><li>Insured, tracked delivery</li><li>3–5 business days within India</li><li>International shipping available</li></ul>",
    status: "published",
    showInFooter: true,
    createdAt: now,
    updatedAt: now,
  },
];

const mockPageRepository: PageRepository = {
  async findAll() {
    return store.map((p) => ({ ...p }));
  },
  async findById(id) {
    const p = store.find((x) => x.id === id);
    return p ? { ...p } : null;
  },
  async findBySlug(slug) {
    const p = store.find((x) => x.slug === slug);
    return p ? { ...p } : null;
  },
  async create(page) {
    store.unshift(page);
    return { ...page };
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

export function getPageRepository(): PageRepository {
  switch (env.DATA_SOURCE) {
    case "mongo":
      throw new Error("Mongo page repository not implemented yet");
    case "mock":
    default:
      return mockPageRepository;
  }
}
