/**
 * Banners domain — repository.
 *
 * Two implementations behind one interface:
 *  • mock  — in-memory, seeded from `data/banners.ts`.
 *  • mongo — Mongoose model (production), soft-delete aware.
 */

import { dataSourceFor } from "@/core/config/env";
import { banners as seed } from "@/data/banners";
import type { Banner } from "./banner.types";
import type { BannerDoc } from "./banner.model";

export interface BannerRepository {
  findAll(): Promise<Banner[]>;
  findById(id: string): Promise<Banner | null>;
  create(banner: Banner): Promise<Banner>;
  update(id: string, patch: Partial<Banner>): Promise<Banner | null>;
  remove(id: string): Promise<boolean>;
}

const store: Banner[] = seed.map((b) => ({ ...b }));

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

/* ------------------------------------------------------------------ *
 * Mongo (Mongoose model, soft-delete aware)
 * ------------------------------------------------------------------ */
async function model() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  const { BannerModel } = await import("./banner.model");
  await connectMongoose();
  return BannerModel;
}

const notDeleted = { isDeleted: { $ne: true } };

function isObjectId(id: string): boolean {
  return /^[a-f0-9]{24}$/i.test(id);
}

function fromDoc(doc: BannerDoc): Banner {
  const ts = doc as unknown as { createdAt?: Date };
  return {
    id: String(doc._id),
    placement: doc.placement as Banner["placement"],
    eyebrow: doc.eyebrow ?? undefined,
    title: doc.title,
    subtitle: doc.subtitle ?? undefined,
    image: doc.image ?? undefined,
    ctaLabel: doc.ctaLabel ?? undefined,
    ctaHref: doc.ctaHref ?? undefined,
    order: doc.order ?? 0,
    active: Boolean(doc.active),
    startsAt: doc.startsAt ?? undefined,
    endsAt: doc.endsAt ?? undefined,
    createdAt: ts.createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

function toDoc(p: Partial<Banner>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.placement !== undefined) out.placement = p.placement;
  if (p.eyebrow !== undefined) out.eyebrow = p.eyebrow ?? null;
  if (p.title !== undefined) out.title = p.title;
  if (p.subtitle !== undefined) out.subtitle = p.subtitle ?? null;
  if (p.image !== undefined) out.image = p.image ?? null;
  if (p.ctaLabel !== undefined) out.ctaLabel = p.ctaLabel ?? null;
  if (p.ctaHref !== undefined) out.ctaHref = p.ctaHref ?? null;
  if (p.order !== undefined) out.order = p.order;
  if (p.active !== undefined) out.active = p.active;
  if (p.startsAt !== undefined) out.startsAt = p.startsAt ?? null;
  if (p.endsAt !== undefined) out.endsAt = p.endsAt ?? null;
  return out;
}

const mongoBannerRepository: BannerRepository = {
  async findAll() {
    const M = await model();
    const docs = await M.find(notDeleted).sort({ placement: 1, order: 1, createdAt: -1 }).lean<BannerDoc[]>();
    return docs.map(fromDoc);
  },
  async findById(id) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOne({ _id: id, ...notDeleted }).lean<BannerDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async create(banner) {
    const M = await model();
    const created = await M.create(toDoc(banner));
    return fromDoc(created.toObject() as BannerDoc);
  },
  async update(id, patch) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: toDoc(patch) },
      { new: true, runValidators: true },
    ).lean<BannerDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async remove(id) {
    const M = await model();
    if (!isObjectId(id)) return false;
    const res = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    ).lean<BannerDoc>();
    return Boolean(res);
  },
};

export function getBannerRepository(): BannerRepository {
  switch (dataSourceFor("banners")) {
    case "mongo":
      return mongoBannerRepository;
    case "mock":
    default:
      return mockBannerRepository;
  }
}
