/**
 * Collections domain — repository. Mock in-memory store seeded from
 * `data/collections.ts`. Swap for Mongo later with no service changes.
 */

import { env } from "@/core/config/env";
import { collections as seed } from "@/data/collections";
import type { Collection } from "@/types";

export interface CollectionRepository {
  findAll(): Promise<Collection[]>;
  findById(id: string): Promise<Collection | null>;
  findBySlug(slug: string): Promise<Collection | null>;
  create(collection: Collection): Promise<Collection>;
  update(id: string, patch: Partial<Collection>): Promise<Collection | null>;
  remove(id: string): Promise<boolean>;
}

const store: Collection[] = seed.map((c) => ({ ...c }));

const mockCollectionRepository: CollectionRepository = {
  async findAll() {
    return store.map((c) => ({ ...c }));
  },
  async findById(id) {
    const c = store.find((x) => x.id === id);
    return c ? { ...c } : null;
  },
  async findBySlug(slug) {
    const c = store.find((x) => x.slug === slug);
    return c ? { ...c } : null;
  },
  async create(collection) {
    store.unshift(collection);
    return { ...collection };
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

export function getCollectionRepository(): CollectionRepository {
  switch (env.DATA_SOURCE) {
    case "mongo":
      throw new Error("Mongo collection repository not implemented yet");
    case "mock":
    default:
      return mockCollectionRepository;
  }
}
