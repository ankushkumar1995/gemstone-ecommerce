/**
 * Categories domain — repository. Mock in-memory store seeded from
 * `data/categories.ts`. Swap for Mongo later with no service changes.
 */

import { env } from "@/core/config/env";
import { categories as seed } from "@/data/categories";
import type { Category } from "@/types";

export interface CategoryRepository {
  findAll(): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  create(category: Category): Promise<Category>;
  update(id: string, patch: Partial<Category>): Promise<Category | null>;
  remove(id: string): Promise<boolean>;
}

const store: Category[] = seed.map((c) => ({ ...c }));

function sorted(list: Category[]): Category[] {
  return [...list].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

const mockCategoryRepository: CategoryRepository = {
  async findAll() {
    return sorted(store).map((c) => ({ ...c }));
  },
  async findById(id) {
    const c = store.find((x) => x.id === id);
    return c ? { ...c } : null;
  },
  async findBySlug(slug) {
    const c = store.find((x) => x.slug === slug);
    return c ? { ...c } : null;
  },
  async create(category) {
    store.push(category);
    return { ...category };
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

export function getCategoryRepository(): CategoryRepository {
  switch (env.DATA_SOURCE) {
    case "mongo":
      throw new Error("Mongo category repository not implemented yet");
    case "mock":
    default:
      return mockCategoryRepository;
  }
}
