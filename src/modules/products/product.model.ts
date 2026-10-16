import "server-only";

/**
 * Product — Mongoose model (single source of truth for the DB schema).
 * ─────────────────────────────────────────────────────────────────────
 * The production catalogue schema for the gemstone / jewellery store. Built to
 * cover the full real-world surface: variants, inventory, media, shipping,
 * gemstone attributes, SEO, merchandising and rollups — while mirroring the
 * exact conventions of the categories model:
 *
 *  • `_id` is a native ObjectId (Mongo-generated). The app sees it as a string
 *    `id` via the repository mapper / toJSON transform — we never store our own
 *    string ids.
 *  • Soft delete: documents are never hard-removed; `isDeleted`/`deletedAt`
 *    flag them so order/review references never break and data is recoverable.
 *  • `status` controls storefront visibility (draft/archived stay hidden).
 *  • Validation is enforced at the DB layer (required, enum, min, match) so bad
 *    data can't be written even if a caller bypasses the zod layer.
 *  • `costPrice` is `select:false` and stripped from JSON — margin data never
 *    leaks to the storefront.
 *  • Indexes are shaped around real queries: slug/sku lookups, text search,
 *    filtered + ordered catalogue listings.
 */

import { Schema, model, models, type Model, type InferSchemaType, type Types } from "mongoose";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* ── Sub-schemas ─────────────────────────────────────────────────────────── */

const VariantOptionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    values: { type: [String], default: [] },
  },
  { _id: false },
);

const VariantSchema = new Schema(
  {
    sku: { type: String, trim: true, maxlength: 80 },
    // optionValues: { "Size": "7", "Metal": "Gold" } — flexible map.
    optionValues: { type: Schema.Types.Mixed, default: {} },
    price: { type: Number, min: [0, "variant price cannot be negative"] },
    mrp: { type: Number, min: [0, "variant mrp cannot be negative"] },
    stockQty: { type: Number, default: 0, min: 0 },
    weightGram: { type: Number, min: 0 },
    barcode: { type: String, trim: true, maxlength: 80 },
    image: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { _id: false },
);

const VideoSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    kind: { type: String, enum: ["video", "spin360"], default: "video" },
    label: { type: String, trim: true, maxlength: 80 },
  },
  { _id: false },
);

const DimensionsSchema = new Schema(
  {
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
  },
  { _id: false },
);

const GemstoneSchema = new Schema(
  {
    stone: { type: String, trim: true, maxlength: 120 },
    planet: { type: String, trim: true, maxlength: 40 },
    benefits: { type: [String], default: [] },
    origin: { type: String, trim: true, maxlength: 120 },
    weightCarat: { type: Number, min: 0 },
    certification: { type: String, trim: true, maxlength: 120 },
    color: { type: String, trim: true, maxlength: 80 },
    clarity: { type: String, trim: true, maxlength: 80 },
    cut: { type: String, trim: true, maxlength: 80 },
    treatment: { type: String, trim: true, maxlength: 120 },
    labName: { type: String, trim: true, maxlength: 120 },
    certificateNumber: { type: String, trim: true, maxlength: 120 },
  },
  { _id: false },
);

const ContentSectionSchema = new Schema(
  {
    heading: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, trim: true, maxlength: 8000 },
  },
  { _id: false },
);

const SpecSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 120 },
    value: { type: String, trim: true, maxlength: 400 },
  },
  { _id: false },
);

const FaqSchema = new Schema(
  {
    q: { type: String, required: true, trim: true, maxlength: 300 },
    a: { type: String, trim: true, maxlength: 2000 },
  },
  { _id: false },
);

const SeoSchema = new Schema(
  {
    metaTitle: { type: String, trim: true, maxlength: 70 },
    metaDescription: { type: String, trim: true, maxlength: 320 },
    ogImage: { type: String, trim: true },
    keywords: { type: [String], default: [] },
    noindex: { type: Boolean, default: false },
  },
  { _id: false },
);

/* ── Main schema ─────────────────────────────────────────────────────────── */

const ProductSchema = new Schema(
  {
    // ── Identity ─────────────────────────────────────────────────
    sku: {
      type: String,
      required: [true, "sku is required"],
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    slug: {
      type: String,
      required: [true, "slug is required"],
      lowercase: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
      match: [SLUG_RE, "slug must be lowercase words separated by single hyphens"],
    },
    name: {
      type: String,
      required: [true, "name is required"],
      trim: true,
      minlength: 2,
      maxlength: 160,
    },
    subtitle: { type: String, trim: true, maxlength: 200 },
    brand: { type: String, trim: true, maxlength: 120 },

    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
      index: true,
    },

    // ── Taxonomy / relations ─────────────────────────────────────
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null, index: true },
    // Category slug (storefront-facing taxonomy). Mirrors the categories module
    // slug; kept alongside categoryId so storefront reads resolve without a join.
    categorySlug: { type: String, trim: true, lowercase: true, default: "", index: true },
    collectionIds: { type: [Schema.Types.ObjectId], ref: "Collection", default: [] },
    tags: { type: [String], default: [], index: true },
    zodiac: { type: [String], default: [] },
    relatedIds: { type: [Schema.Types.ObjectId], ref: "Product", default: [] },

    // ── Pricing ──────────────────────────────────────────────────
    price: { type: Number, required: [true, "price is required"], min: [0, "price cannot be negative"] },
    mrp: { type: Number, min: [0, "mrp cannot be negative"], default: 0 },
    costPrice: { type: Number, min: 0, select: false },
    currency: { type: String, default: "INR", trim: true, uppercase: true, maxlength: 3 },
    taxClass: {
      type: String,
      enum: ["none", "gst_3", "gst_5", "gst_12", "gst_18"],
      default: "gst_3",
    },
    hsnCode: { type: String, trim: true, maxlength: 20 },

    // ── Variants ─────────────────────────────────────────────────
    hasVariants: { type: Boolean, default: false },
    options: { type: [VariantOptionSchema], default: [] },
    variants: { type: [VariantSchema], default: [] },

    // ── Inventory ────────────────────────────────────────────────
    trackInventory: { type: Boolean, default: true },
    stockQty: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 3, min: 0 },
    allowBackorder: { type: Boolean, default: false },
    warehouseLocation: { type: String, trim: true, maxlength: 120 },

    // ── Media ────────────────────────────────────────────────────
    coverImage: { type: String, required: [true, "coverImage is required"], trim: true },
    images: { type: [String], default: [] },
    // Per-image alt text keyed by image URL (SEO / accessibility).
    imageAlts: { type: Schema.Types.Mixed, default: {} },
    videos: { type: [VideoSchema], default: [] },
    certificatePdf: { type: String, trim: true },

    // ── Shipping ─────────────────────────────────────────────────
    weightGram: { type: Number, min: 0 },
    dimensions: { type: DimensionsSchema, default: undefined },
    shippingClass: {
      type: String,
      enum: ["standard", "fragile", "insured", "free"],
      default: "standard",
    },
    makingCharges: { type: Number, min: 0 },

    // ── Gemstone attributes ──────────────────────────────────────
    gemstone: { type: GemstoneSchema, default: undefined },

    // ── Content & SEO ────────────────────────────────────────────
    shortDescription: { type: String, trim: true, maxlength: 600 },
    description: { type: String, trim: true, maxlength: 20000 },
    contentSections: { type: [ContentSectionSchema], default: [] },
    specifications: { type: [SpecSchema], default: [] },
    faqs: { type: [FaqSchema], default: [] },
    seo: { type: SeoSchema, default: undefined },

    // ── Merchandising ────────────────────────────────────────────
    featured: { type: Boolean, default: false, index: true },
    badge: {
      type: String,
      enum: ["Bestseller", "New", "Limited", "Certified", null],
      default: null,
    },
    bestseller: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    publishAt: { type: Date, default: null },

    // ── Rollups (denormalised for fast reads) ────────────────────
    ratingAvg: { type: Number, default: 0, min: 0 },
    ratingCount: { type: Number, default: 0, min: 0 },
    soldCount: { type: Number, default: 0, min: 0 },
    viewCount: { type: Number, default: 0, min: 0 },

    // ── Soft delete ──────────────────────────────────────────────
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },

    // ── Audit ────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
  },
  {
    collection: "products",
    timestamps: true, // createdAt + updatedAt
    versionKey: false,
    // Clean API shape: expose `id`, drop `_id`/internal/sensitive fields.
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.costPrice;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

/* ── Indexes shaped around real query patterns ──────────────────────────────
 * - unique sku / slug among non-deleted docs (partial filter)
 * - full-text search across name + shortDescription + tags
 * - filtered + ordered catalogue listings (category / featured / price)
 * - variant sku lookups
 */
ProductSchema.index(
  { sku: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
ProductSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
ProductSchema.index({ name: "text", shortDescription: "text", tags: "text" });
ProductSchema.index({ isDeleted: 1, status: 1, categoryId: 1, displayOrder: 1 });
ProductSchema.index({ isDeleted: 1, status: 1, featured: 1 });
ProductSchema.index({ isDeleted: 1, status: 1, price: 1 });
ProductSchema.index({ "variants.sku": 1 });

export type ProductDoc = InferSchemaType<typeof ProductSchema> & { _id: Types.ObjectId };

/** Reuse across hot reloads (Next dev) to avoid OverwriteModelError. */
export const ProductModel: Model<ProductDoc> =
  (models.Product as Model<ProductDoc>) ?? model<ProductDoc>("Product", ProductSchema);
