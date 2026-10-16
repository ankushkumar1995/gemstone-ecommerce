/**
 * Products domain — repository.
 *
 * Two implementations behind one interface:
 *  • mock  — in-memory seed from `data/products.ts` (used when
 *            DATA_SOURCE_PRODUCTS != mongo). Create/update/delete persist for
 *            the session so the admin UI feels real.
 *  • mongo — Mongoose model (production), soft-delete aware. Ready to switch on
 *            with DATA_SOURCE_PRODUCTS=mongo once products are seeded.
 *
 * The service/controller never change; only this file knows where data lives.
 */

import { dataSourceFor } from "@/core/config/env";
import { products as seed } from "@/data/products";
import type { Product } from "@/types";
import type { ProductDoc } from "./product.model";
import type { ProductSearchFilters } from "./product.types";

/** A single production variant (one entry of `Product.fullVariants`). */
export type FullVariant = NonNullable<Product["fullVariants"]>[number];

/* ------------------------------------------------------------------ *
 * Interface
 * ------------------------------------------------------------------ */

export interface ProductSearch {
  skip: number;
  limit: number;
  sort: Record<string, 1 | -1>;
  q?: string;
  filters?: ProductSearchFilters;
}

export interface ProductRepository {
  findAll(): Promise<Product[]>;
  /** Soft-deleted products only (for the admin trash / restore view). */
  findDeleted(): Promise<Product[]>;
  /**
   * Low / out-of-stock products (restock report). A product is included when
   * its stockQty is at or below its own lowStockThreshold (so each product's
   * threshold is respected), optionally also OUT only. Sorted lowest-first.
   */
  findLowStock(opts?: { outOnly?: boolean }): Promise<Product[]>;
  /** Paginated + searchable + filterable listing. Returns the page + total. */
  search(params: ProductSearch): Promise<{ items: Product[]; total: number }>;
  findById(id: string): Promise<Product | null>;
  findBySlug(slug: string): Promise<Product | null>;
  /** Is `slug` taken by a different (non-deleted) product? Uniqueness guard. */
  slugTakenBy(slug: string, exceptId?: string): Promise<boolean>;
  /** Is `sku` taken by a different (non-deleted) product? Uniqueness guard. */
  skuTakenBy(sku: string, exceptId?: string): Promise<boolean>;
  create(product: Product): Promise<Product>;
  update(id: string, patch: Partial<Product>): Promise<Product | null>;
  /** Soft delete (flag). */
  remove(id: string): Promise<boolean>;
  /** Undo a soft delete. */
  restore(id: string): Promise<Product | null>;
  /** Apply the same patch to many products at once. Returns affected count. */
  bulkUpdate(ids: string[], patch: Partial<Product>): Promise<number>;

  /* --- variant-level operations (operate on `fullVariants`) --- */
  /** Append one variant. Returns the updated product (null if not found). */
  addVariant(id: string, variant: FullVariant): Promise<Product | null>;
  /** Patch a single variant found by its SKU. Returns updated product. */
  updateVariant(id: string, sku: string, patch: Partial<FullVariant>): Promise<Product | null>;
  /** Remove a single variant found by its SKU. Returns updated product. */
  removeVariant(id: string, sku: string): Promise<Product | null>;

  /**
   * Atomically increment a rollup counter (`viewCount` / `soldCount`). Uses a
   * single `$inc` on Mongo (no read-modify-write race). Returns updated product.
   */
  incCounter(id: string, counter: "view" | "sold", by: number): Promise<Product | null>;
}

/* ------------------------------------------------------------------ *
 * Mock (in-memory, seeded)
 * ------------------------------------------------------------------ */
const store: Product[] = seed.map((p) => ({ ...p }));

function matchesFilters(p: Product, f?: ProductSearchFilters): boolean {
  if (!f) return true;
  if (f.categoryId && p.categoryId !== f.categoryId && p.category !== f.categoryId) return false;
  if (f.status && (p.status ?? "active") !== f.status) return false;
  if (f.featured !== undefined && Boolean(p.featured) !== f.featured) return false;
  if (f.minPrice !== undefined && p.price < f.minPrice) return false;
  if (f.maxPrice !== undefined && p.price > f.maxPrice) return false;
  if (f.inStock !== undefined && p.inStock !== f.inStock) return false;
  if (f.tag && !(p.tags ?? []).includes(f.tag)) return false;
  return true;
}

const mockProductRepository: ProductRepository = {
  async findAll() {
    return store.map((p) => ({ ...p }));
  },
  async findDeleted() {
    // Mock hard-deletes, so there is never anything in the trash.
    return [];
  },
  async findLowStock(opts) {
    const list = store
      .map((p) => ({ ...p }))
      .filter((p) => {
        const qty = p.stockQty ?? 0;
        const low = p.lowStockThreshold ?? 3;
        return opts?.outOnly ? qty <= 0 : qty <= low;
      })
      .sort((a, b) => (a.stockQty ?? 0) - (b.stockQty ?? 0));
    return list;
  },
  async search({ skip, limit, sort, q, filters }) {
    let list = store.map((p) => ({ ...p }));
    if (q) {
      const needle = q.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.slug.toLowerCase().includes(needle) ||
          (p.sku ?? "").toLowerCase().includes(needle) ||
          p.shortDescription.toLowerCase().includes(needle) ||
          (p.tags ?? []).some((t) => t.toLowerCase().includes(needle)),
      );
    }
    list = list.filter((p) => matchesFilters(p, filters));
    const [key, dir] = Object.entries(sort)[0] ?? ["createdAt", -1];
    list.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[key] as string | number | undefined | null;
      const bv = (b as unknown as Record<string, unknown>)[key] as string | number | undefined | null;
      if (av === bv) return 0;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      return (av > bv ? 1 : -1) * (dir as number);
    });
    const total = list.length;
    return { items: list.slice(skip, skip + limit), total };
  },
  async findById(id) {
    const p = store.find((x) => x.id === id);
    return p ? { ...p } : null;
  },
  async findBySlug(slug) {
    const p = store.find((x) => x.slug === slug);
    return p ? { ...p } : null;
  },
  async slugTakenBy(slug, exceptId) {
    return store.some((x) => x.slug === slug && x.id !== exceptId);
  },
  async skuTakenBy(sku, exceptId) {
    const needle = sku.toUpperCase();
    return store.some((x) => (x.sku ?? "").toUpperCase() === needle && x.id !== exceptId);
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
  async restore(id) {
    // Mock hard-deletes, so there's nothing to restore.
    const p = store.find((x) => x.id === id);
    return p ? { ...p } : null;
  },
  async bulkUpdate(ids, patch) {
    let count = 0;
    for (const id of ids) {
      const idx = store.findIndex((x) => x.id === id);
      if (idx !== -1) {
        store[idx] = { ...store[idx], ...patch };
        count += 1;
      }
    }
    return count;
  },
  async addVariant(id, variant) {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    const list = [...(store[idx].fullVariants ?? []), variant];
    store[idx] = { ...store[idx], fullVariants: list, hasVariants: true };
    return { ...store[idx] };
  },
  async updateVariant(id, sku, patch) {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    const list = (store[idx].fullVariants ?? []).map((v) =>
      v.sku === sku ? { ...v, ...patch } : v,
    );
    store[idx] = { ...store[idx], fullVariants: list };
    return { ...store[idx] };
  },
  async removeVariant(id, sku) {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    const list = (store[idx].fullVariants ?? []).filter((v) => v.sku !== sku);
    store[idx] = { ...store[idx], fullVariants: list, hasVariants: list.length > 0 };
    return { ...store[idx] };
  },
  async incCounter(id, counter, by) {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    const field = counter === "view" ? "viewCount" : "soldCount";
    store[idx] = { ...store[idx], [field]: (store[idx][field] ?? 0) + by };
    return { ...store[idx] };
  },
};

/* ------------------------------------------------------------------ *
 * Mongo (Mongoose model, soft-delete aware)
 * ------------------------------------------------------------------ */
async function model() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  const { ProductModel } = await import("./product.model");
  await connectMongoose();
  return ProductModel;
}

/** Only non-deleted docs are ever surfaced to the app. */
const notDeleted = { isDeleted: { $ne: true } };

/** Normalise Mongoose's `string | null` optionals to `string | undefined`. */
function nn<T>(v: T | null | undefined): T | undefined {
  return v === null ? undefined : v;
}

/** Map a Mongoose lean doc → the app's Product shape (keeps storefront compat). */
function fromDoc(doc: ProductDoc): Product {
  const stockQty = doc.stockQty ?? 0;
  const low = doc.lowStockThreshold ?? 3;
  const inStock = doc.allowBackorder ? true : stockQty > 0;
  const stockStatus = !inStock
    ? doc.allowBackorder
      ? "backorder"
      : "out_of_stock"
    : stockQty <= low
    ? "low_stock"
    : "in_stock";

  const gem = (doc.gemstone ?? {}) as NonNullable<ProductDoc["gemstone"]>;

  return {
    id: String(doc._id),
    slug: doc.slug,
    name: doc.name,
    // Legacy storefront field: fall back to the stored category slug if present.
    category: (doc as unknown as { categorySlug?: string }).categorySlug ?? "",
    price: doc.price,
    mrp: doc.mrp ?? doc.price,
    rating: doc.ratingAvg ?? 0,
    reviews: doc.ratingCount ?? 0,
    image: doc.coverImage,
    gradient: "linear-gradient(135deg, #e6b43a 0%, #9169ff 55%, #2a1d5e 120%)",
    zodiac: (doc.zodiac ?? []) as Product["zodiac"],
    badge: (doc.badge ?? undefined) as Product["badge"],
    shortDescription: doc.shortDescription ?? "",
    attributes: {
      stone: gem.stone ?? doc.name,
      planet: (gem.planet ?? "Jupiter") as Product["attributes"]["planet"],
      benefits: gem.benefits ?? [],
      origin: gem.origin ?? "—",
      weightCarat: gem.weightCarat ?? 0,
      certification: gem.certification ?? "Lab Certified",
      color: gem.color ?? "—",
    },
    inStock,

    /* extended / production surface */
    status: (doc.status === "active" ? "active" : doc.status === "archived" ? "archived" : "draft"),
    stockQty,
    sku: doc.sku,
    tags: doc.tags ?? [],
    images: doc.images ?? [],
    imageAlts: (doc.imageAlts ?? {}) as Record<string, string>,
    featured: Boolean(doc.featured),
    publishAt: doc.publishAt instanceof Date ? doc.publishAt.toISOString() : undefined,
    seo: doc.seo
      ? {
          metaTitle: nn(doc.seo.metaTitle),
          metaDescription: nn(doc.seo.metaDescription),
          ogImage: nn(doc.seo.ogImage),
          keywords: doc.seo.keywords ?? [],
          noindex: doc.seo.noindex ?? false,
        }
      : undefined,
    videos: (doc.videos ?? []).map((v, i) => ({
      id: `vid_${i}`,
      url: v.url,
      kind: (v.kind ?? "video") as "video" | "spin360",
      label: v.label ?? undefined,
    })),
    certificatePdf: doc.certificatePdf ?? undefined,
    collections: (doc.collectionIds ?? []).map(String),
    related: (doc.relatedIds ?? []).map(String),

    subtitle: doc.subtitle ?? undefined,
    brand: doc.brand ?? undefined,
    categoryId: doc.categoryId ? String(doc.categoryId) : null,
    collectionIds: (doc.collectionIds ?? []).map(String),
    relatedIds: (doc.relatedIds ?? []).map(String),
    currency: doc.currency ?? "INR",
    taxClass: doc.taxClass as Product["taxClass"],
    hsnCode: doc.hsnCode ?? undefined,
    hasVariants: Boolean(doc.hasVariants),
    options: (doc.options ?? []).map((o) => ({ name: o.name, values: o.values ?? [] })),
    fullVariants: (doc.variants ?? []).map((v) => ({
      sku: v.sku ?? undefined,
      optionValues: (v.optionValues ?? {}) as Record<string, string>,
      price: v.price ?? undefined,
      mrp: v.mrp ?? undefined,
      stockQty: v.stockQty ?? 0,
      weightGram: v.weightGram ?? undefined,
      barcode: v.barcode ?? undefined,
      image: v.image ?? undefined,
      isDefault: v.isDefault ?? undefined,
      active: v.active ?? undefined,
    })),
    trackInventory: doc.trackInventory ?? true,
    lowStockThreshold: low,
    allowBackorder: doc.allowBackorder ?? false,
    warehouseLocation: doc.warehouseLocation ?? undefined,
    stockStatus,
    coverImage: doc.coverImage,
    description: doc.description ?? undefined,
    specifications: (doc.specifications ?? []).map((s) => ({ label: s.label, value: s.value ?? undefined })),
    faqs: (doc.faqs ?? []).map((f) => ({ q: f.q, a: f.a ?? undefined })),
    weightGram: doc.weightGram ?? undefined,
    dimensions: doc.dimensions
      ? { length: doc.dimensions.length ?? undefined, width: doc.dimensions.width ?? undefined, height: doc.dimensions.height ?? undefined }
      : undefined,
    shippingClass: doc.shippingClass as Product["shippingClass"],
    makingCharges: doc.makingCharges ?? undefined,
    gemstone: doc.gemstone
      ? {
          stone: nn(gem.stone),
          planet: nn(gem.planet),
          benefits: gem.benefits ?? [],
          origin: nn(gem.origin),
          weightCarat: nn(gem.weightCarat),
          certification: nn(gem.certification),
          color: nn(gem.color),
          clarity: nn(gem.clarity),
          cut: nn(gem.cut),
          treatment: nn(gem.treatment),
          labName: nn(gem.labName),
          certificateNumber: nn(gem.certificateNumber),
        }
      : undefined,
    bestseller: Boolean(doc.bestseller),
    displayOrder: doc.displayOrder ?? 0,
    ratingAvg: doc.ratingAvg ?? 0,
    ratingCount: doc.ratingCount ?? 0,
    soldCount: doc.soldCount ?? 0,
    viewCount: doc.viewCount ?? 0,
  };
}

/**
 * Map an app Product (what the service builds) → a Mongo document shape.
 * Only sets fields that are present; the schema defaults fill the rest.
 */
function toDoc(p: Partial<Product>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const set = <K extends keyof Product>(k: K, mapTo = k as string) => {
    if (p[k] !== undefined) out[mapTo] = p[k];
  };

  set("slug");
  set("name");
  set("subtitle");
  set("brand");
  set("status");
  set("tags");
  set("zodiac");
  set("price");
  set("mrp");
  set("costPrice");
  set("currency");
  set("taxClass");
  set("hsnCode");
  set("hasVariants");
  set("options");
  set("trackInventory");
  set("stockQty");
  set("lowStockThreshold");
  set("allowBackorder");
  set("warehouseLocation");
  set("images");
  set("imageAlts");
  set("certificatePdf");
  set("weightGram");
  set("dimensions");
  set("shippingClass");
  set("makingCharges");
  set("shortDescription");
  set("description");
  set("specifications");
  set("faqs");
  set("seo");
  set("featured");
  set("bestseller");
  set("displayOrder");
  set("ratingAvg");
  set("ratingCount");
  set("soldCount");
  set("viewCount");

  if (p.sku !== undefined) out.sku = p.sku;
  if (p.coverImage !== undefined) out.coverImage = p.coverImage;
  else if (p.image !== undefined) out.coverImage = p.image;
  if (p.categoryId !== undefined) out.categoryId = p.categoryId || null;
  // Persist the storefront category slug (legacy `category` field) so it
  // round-trips: fromDoc reads `categorySlug` back into `category`.
  if (p.category !== undefined) out.categorySlug = p.category;
  if (p.collectionIds !== undefined) out.collectionIds = p.collectionIds;
  if (p.relatedIds !== undefined) out.relatedIds = p.relatedIds;
  if (p.badge !== undefined) out.badge = p.badge ?? null;
  if (p.publishAt !== undefined) out.publishAt = p.publishAt ? new Date(p.publishAt) : null;
  if (p.gemstone !== undefined) out.gemstone = p.gemstone;
  if (p.fullVariants !== undefined) out.variants = p.fullVariants;
  if (p.videos !== undefined) {
    out.videos = p.videos.map((v) => ({ url: v.url, kind: v.kind, label: v.label }));
  }
  return out;
}

/** 24-hex ObjectId guard so a bad id returns null instead of throwing. */
function isObjectId(id: string): boolean {
  return /^[a-f0-9]{24}$/i.test(id);
}

const mongoProductRepository: ProductRepository = {
  async findAll() {
    const M = await model();
    const docs = await M.find(notDeleted).sort({ displayOrder: 1, createdAt: -1 }).lean<ProductDoc[]>();
    return docs.map(fromDoc);
  },
  async findDeleted() {
    const M = await model();
    const docs = await M.find({ isDeleted: true }).sort({ deletedAt: -1 }).lean<ProductDoc[]>();
    return docs.map(fromDoc);
  },
  async findLowStock(opts) {
    const M = await model();
    // Compare each doc's stockQty against its OWN lowStockThreshold via $expr
    // (defaulting a missing threshold to 3). Out-only ignores the threshold.
    const filter = opts?.outOnly
      ? { ...notDeleted, stockQty: { $lte: 0 } }
      : {
          ...notDeleted,
          $expr: {
            $lte: ["$stockQty", { $ifNull: ["$lowStockThreshold", 3] }],
          },
        };
    const docs = await M.find(filter).sort({ stockQty: 1, name: 1 }).lean<ProductDoc[]>();
    return docs.map(fromDoc);
  },
  async search({ skip, limit, sort, q, filters }) {
    const M = await model();
    const filter: Record<string, unknown> = { ...notDeleted };
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { slug: rx }, { sku: rx }, { tags: rx }, { shortDescription: rx }];
    }
    if (filters) {
      if (filters.categoryId && isObjectId(filters.categoryId)) filter.categoryId = filters.categoryId;
      if (filters.status) filter.status = filters.status;
      if (filters.featured !== undefined) filter.featured = filters.featured;
      if (filters.tag) filter.tags = filters.tag;
      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        const price: Record<string, number> = {};
        if (filters.minPrice !== undefined) price.$gte = filters.minPrice;
        if (filters.maxPrice !== undefined) price.$lte = filters.maxPrice;
        filter.price = price;
      }
      if (filters.inStock === true) filter.stockQty = { $gt: 0 };
      if (filters.inStock === false) filter.stockQty = { $lte: 0 };
    }
    const sortSpec = Object.keys(sort).length ? sort : { displayOrder: 1 as const, createdAt: -1 as const };
    const [docs, total] = await Promise.all([
      M.find(filter).sort(sortSpec).skip(skip).limit(limit).lean<ProductDoc[]>(),
      M.countDocuments(filter),
    ]);
    return { items: docs.map(fromDoc), total };
  },
  async findById(id) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOne({ _id: id, ...notDeleted }).lean<ProductDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async findBySlug(slug) {
    const M = await model();
    const doc = await M.findOne({ slug, ...notDeleted }).lean<ProductDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async slugTakenBy(slug, exceptId) {
    const M = await model();
    const q: Record<string, unknown> = { slug, ...notDeleted };
    if (exceptId && isObjectId(exceptId)) q._id = { $ne: exceptId };
    return (await M.countDocuments(q)) > 0;
  },
  async skuTakenBy(sku, exceptId) {
    const M = await model();
    const q: Record<string, unknown> = { sku: sku.toUpperCase(), ...notDeleted };
    if (exceptId && isObjectId(exceptId)) q._id = { $ne: exceptId };
    return (await M.countDocuments(q)) > 0;
  },
  async create(product) {
    const M = await model();
    const created = await M.create(toDoc(product));
    return fromDoc(created.toObject() as ProductDoc);
  },
  async update(id, patch) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: toDoc(patch) },
      { new: true, runValidators: true },
    ).lean<ProductDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async remove(id) {
    const M = await model();
    if (!isObjectId(id)) return false;
    const res = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: { isDeleted: true, deletedAt: new Date(), status: "archived" } },
    ).lean<ProductDoc>();
    return Boolean(res);
  },
  async restore(id) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOneAndUpdate(
      { _id: id, isDeleted: true },
      { $set: { isDeleted: false, deletedAt: null, status: "draft" } },
      { new: true },
    ).lean<ProductDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async bulkUpdate(ids, patch) {
    const M = await model();
    const valid = ids.filter(isObjectId);
    if (valid.length === 0) return 0;
    const res = await M.updateMany({ _id: { $in: valid }, ...notDeleted }, { $set: toDoc(patch) });
    return res.modifiedCount ?? 0;
  },
  async addVariant(id, variant) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $push: { variants: variant }, $set: { hasVariants: true } },
      { new: true, runValidators: true },
    ).lean<ProductDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async updateVariant(id, sku, patch) {
    const M = await model();
    if (!isObjectId(id)) return null;
    // Build positional-$ set for only the provided fields of the matched variant.
    const $set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) $set[`variants.$.${k}`] = v;
    }
    if (Object.keys($set).length === 0) {
      const doc = await M.findOne({ _id: id, ...notDeleted }).lean<ProductDoc>();
      return doc ? fromDoc(doc) : null;
    }
    const doc = await M.findOneAndUpdate(
      { _id: id, "variants.sku": sku, ...notDeleted },
      { $set },
      { new: true, runValidators: true },
    ).lean<ProductDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async removeVariant(id, sku) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $pull: { variants: { sku } } },
      { new: true },
    ).lean<ProductDoc>();
    if (!doc) return null;
    // Keep hasVariants in sync if the matrix is now empty.
    if ((doc.variants ?? []).length === 0 && doc.hasVariants) {
      const synced = await M.findOneAndUpdate(
        { _id: id, ...notDeleted },
        { $set: { hasVariants: false } },
        { new: true },
      ).lean<ProductDoc>();
      return synced ? fromDoc(synced) : fromDoc(doc);
    }
    return fromDoc(doc);
  },
  async incCounter(id, counter, by) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const field = counter === "view" ? "viewCount" : "soldCount";
    const doc = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $inc: { [field]: by } },
      { new: true },
    ).lean<ProductDoc>();
    return doc ? fromDoc(doc) : null;
  },
};

export function getProductRepository(): ProductRepository {
  switch (dataSourceFor("products")) {
    case "mongo":
      return mongoProductRepository;
    case "mock":
    default:
      return mockProductRepository;
  }
}
