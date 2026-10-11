/**
 * Services domain — repository. Mock in-memory store seeded from
 * `data/services.ts`. Swap for Mongo later via getServiceRepository().
 */

import { env } from "@/core/config/env";
import { services as seed } from "@/data/services";
import type { AstroService } from "@/types";

export interface ServiceRepository {
  findAll(): Promise<AstroService[]>;
  findById(id: string): Promise<AstroService | null>;
  findBySlug(slug: string): Promise<AstroService | null>;
  create(service: AstroService): Promise<AstroService>;
  update(id: string, patch: Partial<AstroService>): Promise<AstroService | null>;
  remove(id: string): Promise<boolean>;
}

const store: AstroService[] = seed.map((s) => ({ ...s }));

function sorted(list: AstroService[]): AstroService[] {
  return [...list].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

const mockServiceRepository: ServiceRepository = {
  async findAll() {
    return sorted(store).map((s) => ({ ...s }));
  },
  async findById(id) {
    const s = store.find((x) => x.id === id);
    return s ? { ...s } : null;
  },
  async findBySlug(slug) {
    const s = store.find((x) => x.slug === slug);
    return s ? { ...s } : null;
  },
  async create(service) {
    store.push(service);
    return { ...service };
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

export function getServiceRepository(): ServiceRepository {
  switch (env.DATA_SOURCE) {
    case "mongo":
      throw new Error("Mongo service repository not implemented yet");
    case "mock":
    default:
      return mockServiceRepository;
  }
}
