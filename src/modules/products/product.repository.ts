/**
 * Products domain — repository.
 *
 * The only place that knows where products live. The mock implementation
 * seeds from the existing `data/products.ts` into a mutable in-memory store,
 * so admin create/update/delete actually persist for the session. Swap for a
 * Mongo implementation later with zero changes to the service/controller.
 */

import { env } from "@/core/config/env";
import { products as seed } from "@/data/products";
import type { Product } from "@/types";

export interface ProductRepository {
  findAll(): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  findBySlug(slug: string): Promise<Product | null>;
  create(product: Product): Promise<Product>;
  update(id: string, patch: Partial<Product>): Promise<Product | null>;
  remove(id: string): Promise<boolean>;
}

/* ---- mock (in-memory, seeded) ---- */
const store: Product[] = seed.map((p) => ({ ...p }));

const mockProductRepository: ProductRepository = {
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
  async create(product) {
    store.unshift(product);
    return { ...product };
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

export function getProductRepository(): ProductRepository {
  switch (env.DATA_SOURCE) {
    case "mongo":
      throw new Error("Mongo product repository not implemented yet");
    case "mock":
    default:
      return mockProductRepository;
  }
}
