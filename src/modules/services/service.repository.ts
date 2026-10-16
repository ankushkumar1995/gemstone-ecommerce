/**
 * Services domain — repository. Mock in-memory store seeded from
 * `data/services.ts`. Swap for Mongo later via getServiceRepository().
 */

import { dataSourceFor } from "@/core/config/env";
import { services as seed } from "@/data/services";
import type { AstroService } from "@/types";
import type { ServiceDoc } from "./service.model";

/** Map a Mongoose doc to the app's AstroService shape. */
function fromDoc(doc: ServiceDoc): AstroService {
  const ts = doc as unknown as { createdAt?: Date; updatedAt?: Date };
  return {
    id: String(doc._id),
    slug: doc.slug,
    title: doc.title,
    tagline: doc.tagline,
    description: doc.description,
    icon: doc.icon,
    priceFrom: doc.priceFrom,
    duration: doc.duration,
    popular: doc.popular,
    features: doc.features,
    status: doc.status,
    order: doc.order,
    createdAt: ts.createdAt?.toISOString(),
    updatedAt: ts.updatedAt?.toISOString(),
  };
}

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

/* ---- mongo (Mongoose model) ---- */
function mongoServiceRepository(): ServiceRepository {
  async function model() {
    const { connectMongoose } = await import("@/core/db/mongoose");
    const { ServiceModel } = await import("./service.model");
    await connectMongoose();
    return ServiceModel;
  }
  return {
    async findAll() {
      const M = await model();
      const docs = await M.find().sort({ order: 1 }).lean<ServiceDoc[]>();
      return docs.map(fromDoc);
    },
    async findById(id) {
      const M = await model();
      if (!/^[a-f0-9]{24}$/i.test(id)) return null;
      const doc = await M.findById(id).lean<ServiceDoc>();
      return doc ? fromDoc(doc) : null;
    },
    async findBySlug(slug) {
      const M = await model();
      const doc = await M.findOne({ slug }).lean<ServiceDoc>();
      return doc ? fromDoc(doc) : null;
    },
    async create(service) {
      const M = await model();
      // Drop the app-generated string id — Mongo assigns a real ObjectId.
      const { id, createdAt, updatedAt, ...rest } = service;
      void id;
      void createdAt;
      void updatedAt;
      const created = await M.create(rest);
      return fromDoc(created.toObject() as ServiceDoc);
    },
    async update(id, patch) {
      const M = await model();
      if (!/^[a-f0-9]{24}$/i.test(id)) return null;
      const { id: _ignore, createdAt, updatedAt, ...safe } = patch as Partial<AstroService> & { id?: string };
      void _ignore;
      void createdAt;
      void updatedAt;
      const doc = await M.findByIdAndUpdate(id, { $set: safe }, { new: true, runValidators: true }).lean<ServiceDoc>();
      return doc ? fromDoc(doc) : null;
    },
    async remove(id) {
      const M = await model();
      if (!/^[a-f0-9]{24}$/i.test(id)) return false;
      const res = await M.findByIdAndDelete(id).lean<ServiceDoc>();
      return Boolean(res);
    },
  };
}

export function getServiceRepository(): ServiceRepository {
  switch (dataSourceFor("services")) {
    case "mongo":
      return mongoServiceRepository();
    case "mock":
    default:
      return mockServiceRepository;
  }
}
