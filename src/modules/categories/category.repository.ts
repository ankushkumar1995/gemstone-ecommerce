/**
 * Categories domain — repository.
 *
 * Two implementations behind one interface:
 *  • mock  — in-memory seed (used when DATA_SOURCE_CATEGORIES != mongo)
 *  • mongo — Mongoose model (production), soft-delete aware
 *
 * The service/controller never change; only this file knows where data lives.
 */

import { dataSourceFor } from "@/core/config/env";
import { categories as seed } from "@/data/categories";
import type { Category } from "@/types";
import type { CategoryDoc } from "./category.model";

/** Map a Mongoose lean doc → the app's Category shape (ObjectId → string id). */
function fromDoc(doc: CategoryDoc): Category {
  return {
    id: String(doc._id),
    slug: doc.slug,
    title: doc.title,
    tagline: doc.tagline ?? "",
    image: doc.image,
    tint: doc.tint ?? "",
    order: doc.order,
    status: doc.status,
    createdAt:
      doc.createdAt instanceof Date ? doc.createdAt.toISOString() : (doc.createdAt as string | undefined),
    updatedAt:
      doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : (doc.updatedAt as string | undefined),
  };
}

export interface CategorySearch {
  skip: number;
  limit: number;
  sort: Record<string, 1 | -1>;
  q?: string;
}

export interface CategoryRepository {
  findAll(): Promise<Category[]>;
  /** Paginated + searchable listing. Returns the page + the total match count. */
  search(params: CategorySearch): Promise<{ items: Category[]; total: number }>;
  findById(id: string): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  /** Is `slug` taken by a different (non-deleted) category? For uniqueness guard. */
  slugTakenBy(slug: string, exceptId?: string): Promise<boolean>;
  create(input: CreateCategoryInput): Promise<Category>;
  update(id: string, patch: Partial<Category>): Promise<Category | null>;
  /** Soft delete (flag). */
  remove(id: string): Promise<boolean>;
  /** Undo a soft delete. */
  restore(id: string): Promise<Category | null>;
  /** Set display order for many categories at once (atomic-ish). */
  reorder(items: Array<{ id: string; order: number }>): Promise<boolean>;
}

/** What the service hands the repo to create (no id — the DB assigns it). */
export interface CreateCategoryInput {
  slug: string;
  title: string;
  tagline?: string;
  image: string;
  tint?: string;
  order?: number;
  status?: "active" | "inactive";
}

/* ------------------------------------------------------------------ *
 * Mock (in-memory, seeded)
 * ------------------------------------------------------------------ */
const store: Category[] = seed.map((c) => ({ ...c }));

function sorted(list: Category[]): Category[] {
  return [...list].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

const mockCategoryRepository: CategoryRepository = {
  async findAll() {
    return sorted(store).map((c) => ({ ...c }));
  },
  async search({ skip, limit, sort, q }) {
    let list = store.map((c) => ({ ...c }));
    if (q) {
      const needle = q.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(needle) ||
          c.slug.toLowerCase().includes(needle) ||
          c.tagline.toLowerCase().includes(needle),
      );
    }
    const [key, dir] = Object.entries(sort)[0] ?? ["order", 1];
    list.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[key];
      const bv = (b as unknown as Record<string, unknown>)[key];
      if (av === bv) return 0;
      return (av! > bv! ? 1 : -1) * (dir as number);
    });
    const total = list.length;
    return { items: list.slice(skip, skip + limit), total };
  },
  async findById(id) {
    const c = store.find((x) => x.id === id);
    return c ? { ...c } : null;
  },
  async findBySlug(slug) {
    const c = store.find((x) => x.slug === slug);
    return c ? { ...c } : null;
  },
  async slugTakenBy(slug, exceptId) {
    return store.some((x) => x.slug === slug && x.id !== exceptId);
  },
  async create(input) {
    const c: Category = {
      id: `cat_${Date.now().toString(36)}`,
      status: input.status ?? "active",
      tagline: input.tagline ?? "",
      tint: input.tint ?? "",
      order: input.order ?? store.length + 1,
      slug: input.slug,
      title: input.title,
      image: input.image,
      createdAt: new Date().toISOString(),
    };
    store.push(c);
    return { ...c };
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
  async restore(id) {
    // Mock has no soft-delete concept; nothing to restore.
    const c = store.find((x) => x.id === id);
    return c ? { ...c } : null;
  },
  async reorder(items) {
    for (const { id, order } of items) {
      const c = store.find((x) => x.id === id);
      if (c) c.order = order;
    }
    return true;
  },
};

/* ------------------------------------------------------------------ *
 * Mongo (Mongoose model, soft-delete aware)
 * ------------------------------------------------------------------ */
async function model() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  const { CategoryModel } = await import("./category.model");
  await connectMongoose();
  return CategoryModel;
}

/** Only non-deleted docs are ever surfaced to the app. */
const notDeleted = { isDeleted: { $ne: true } };

const mongoCategoryRepository: CategoryRepository = {
  async findAll() {
    const M = await model();
    const docs = await M.find(notDeleted).sort({ order: 1, createdAt: 1 }).lean<CategoryDoc[]>();
    return docs.map(fromDoc);
  },
  async search({ skip, limit, sort, q }) {
    const M = await model();
    const filter: Record<string, unknown> = { ...notDeleted };
    if (q) {
      // Case-insensitive match on title / slug / tagline.
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: rx }, { slug: rx }, { tagline: rx }];
    }
    const sortSpec = Object.keys(sort).length ? sort : { order: 1 as const };
    // Run the page query and the count in parallel for speed.
    const [docs, total] = await Promise.all([
      M.find(filter).sort(sortSpec).skip(skip).limit(limit).lean<CategoryDoc[]>(),
      M.countDocuments(filter),
    ]);
    return { items: docs.map(fromDoc), total };
  },
  async findById(id) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOne({ _id: id, ...notDeleted }).lean<CategoryDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async findBySlug(slug) {
    const M = await model();
    const doc = await M.findOne({ slug, ...notDeleted }).lean<CategoryDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async slugTakenBy(slug, exceptId) {
    const M = await model();
    const q: Record<string, unknown> = { slug, ...notDeleted };
    if (exceptId && isObjectId(exceptId)) q._id = { $ne: exceptId };
    const count = await M.countDocuments(q);
    return count > 0;
  },
  async create(input) {
    const M = await model();
    const created = await M.create({
      slug: input.slug,
      title: input.title,
      tagline: input.tagline ?? "",
      image: input.image,
      tint: input.tint ?? "",
      order: input.order ?? 0,
      status: input.status ?? "active",
    });
    return fromDoc(created.toObject() as CategoryDoc);
  },
  async update(id, patch) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const { id: _ignore, createdAt: _c, updatedAt: _u, ...safe } = patch as Partial<Category> & {
      id?: string;
    };
    void _ignore;
    void _c;
    void _u;
    const doc = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: safe },
      { new: true, runValidators: true },
    ).lean<CategoryDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async remove(id) {
    const M = await model();
    if (!isObjectId(id)) return false;
    // Soft delete: flag it, keep the row.
    const res = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: { isDeleted: true, deletedAt: new Date(), status: "inactive" } },
    ).lean<CategoryDoc>();
    return Boolean(res);
  },
  async restore(id) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOneAndUpdate(
      { _id: id, isDeleted: true },
      { $set: { isDeleted: false, deletedAt: null, status: "active" } },
      { new: true },
    ).lean<CategoryDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async reorder(items) {
    const M = await model();
    const valid = items.filter((i) => isObjectId(i.id));
    if (valid.length === 0) return false;
    // One bulk write — atomic per-document, far fewer round-trips than N updates.
    await M.bulkWrite(
      valid.map(({ id, order }) => ({
        updateOne: { filter: { _id: id, ...notDeleted }, update: { $set: { order } } },
      })),
    );
    return true;
  },
};

/** 24-hex ObjectId guard so a bad id returns null instead of throwing. */
function isObjectId(id: string): boolean {
  return /^[a-f0-9]{24}$/i.test(id);
}

export function getCategoryRepository(): CategoryRepository {
  switch (dataSourceFor("categories")) {
    case "mongo":
      return mongoCategoryRepository;
    case "mock":
    default:
      return mockCategoryRepository;
  }
}
