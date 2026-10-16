/**
 * Products domain — validation schemas (zod). Used to validate create/update
 * payloads coming from the admin product form before they hit the service.
 */

import { z } from "zod";

const planets = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
] as const;

const zodiacSigns = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
] as const;

const variantSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1).max(60),
  price: z.coerce.number().min(0),
  stockQty: z.coerce.number().min(0),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
});

const seoSchema = z.object({
  metaTitle: z.string().trim().max(70).optional().or(z.literal("")),
  metaDescription: z.string().trim().max(180).optional().or(z.literal("")),
  ogImage: z.string().trim().optional().or(z.literal("")),
  keywords: z.array(z.string()).optional(),
  noindex: z.coerce.boolean().optional(),
});

const contentSectionSchema = z.object({
  id: z.string().optional(),
  heading: z.string().trim().min(1).max(80),
  body: z.string().trim().max(4000),
});

const videoSchema = z.object({
  id: z.string().optional(),
  url: z.string().trim().min(1),
  kind: z.enum(["video", "spin360"]),
  label: z.string().trim().max(80).optional().or(z.literal("")),
});

/* ── Production variant / option / spec / faq schemas ─────────────────────── */

const optionSchema = z.object({
  name: z.string().trim().min(1).max(60),
  values: z.array(z.string().trim().min(1)).default([]),
});

/** Full production variant (option-value matrix + per-variant pricing/stock). */
export const fullVariantSchema = z.object({
  sku: z.string().trim().max(80).optional().or(z.literal("")),
  optionValues: z.record(z.string(), z.string()).default({}),
  price: z.coerce.number().min(0).optional(),
  mrp: z.coerce.number().min(0).optional(),
  stockQty: z.coerce.number().min(0).default(0),
  weightGram: z.coerce.number().min(0).optional(),
  barcode: z.string().trim().max(80).optional().or(z.literal("")),
  image: z.string().trim().optional().or(z.literal("")),
  isDefault: z.coerce.boolean().optional(),
  active: z.coerce.boolean().optional(),
});

const specSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().max(400).optional().or(z.literal("")),
});

const faqSchema = z.object({
  q: z.string().trim().min(1).max(300),
  a: z.string().trim().max(2000).optional().or(z.literal("")),
});

const dimensionsSchema = z.object({
  length: z.coerce.number().min(0).optional(),
  width: z.coerce.number().min(0).optional(),
  height: z.coerce.number().min(0).optional(),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(120),
  // category is a dynamic slug managed by the categories module
  category: z.string().trim().min(1, "Category is required"),
  price: z.coerce.number().min(0, "Price must be ≥ 0"),
  mrp: z.coerce.number().min(0, "MRP must be ≥ 0"),
  image: z.string().trim().optional(),
  images: z.array(z.string()).optional(),
  /** Per-image alt text keyed by image URL (SEO / accessibility). */
  imageAlts: z.record(z.string(), z.string().trim().max(160)).optional(),
  shortDescription: z.string().trim().max(500).optional().or(z.literal("")),
  badge: z.enum(["Bestseller", "New", "Limited", "Certified"]).optional(),
  inStock: z.coerce.boolean().optional(),
  status: z.enum(["draft", "review", "active", "archived"]).optional(),
  stockQty: z.coerce.number().min(0).optional(),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
  variants: z.array(variantSchema).optional(),
  zodiac: z.array(z.enum(zodiacSigns)).optional(),

  /* workflow */
  publishAt: z.string().trim().optional().or(z.literal("")),

  /* SEO & rich content */
  seo: seoSchema.optional(),
  content: z.array(contentSectionSchema).optional(),

  /* media extensions */
  videos: z.array(videoSchema).optional(),
  certificatePdf: z.string().trim().optional().or(z.literal("")),

  /* organisation */
  collections: z.array(z.string()).optional(),
  related: z.array(z.string()).optional(),
  featured: z.coerce.boolean().optional(),
  attributes: z
    .object({
      stone: z.string().trim().max(120).optional().or(z.literal("")),
      planet: z.enum(planets).optional(),
      origin: z.string().trim().max(120).optional().or(z.literal("")),
      weightCarat: z.coerce.number().min(0).optional(),
      certification: z.string().trim().max(120).optional().or(z.literal("")),
      color: z.string().trim().max(80).optional().or(z.literal("")),
      clarity: z.string().trim().max(80).optional().or(z.literal("")),
      cut: z.string().trim().max(80).optional().or(z.literal("")),
      treatment: z.string().trim().max(120).optional().or(z.literal("")),
      labName: z.string().trim().max(120).optional().or(z.literal("")),
      certificateNumber: z.string().trim().max(120).optional().or(z.literal("")),
      benefits: z.array(z.string()).optional(),
    })
    .optional(),

  /* ---------------- production catalogue surface (all optional) ---------- */
  subtitle: z.string().trim().max(200).optional().or(z.literal("")),
  brand: z.string().trim().max(120).optional().or(z.literal("")),
  categoryId: z.string().trim().optional().or(z.literal("")),
  collectionIds: z.array(z.string()).optional(),
  relatedIds: z.array(z.string()).optional(),

  currency: z.string().trim().max(3).optional().or(z.literal("")),
  costPrice: z.coerce.number().min(0).optional(),
  taxClass: z.enum(["none", "gst_3", "gst_5", "gst_12", "gst_18"]).optional(),
  hsnCode: z.string().trim().max(20).optional().or(z.literal("")),

  hasVariants: z.coerce.boolean().optional(),
  options: z.array(optionSchema).optional(),
  fullVariants: z.array(fullVariantSchema).optional(),

  trackInventory: z.coerce.boolean().optional(),
  lowStockThreshold: z.coerce.number().min(0).optional(),
  allowBackorder: z.coerce.boolean().optional(),
  warehouseLocation: z.string().trim().max(120).optional().or(z.literal("")),

  coverImage: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().max(20000).optional().or(z.literal("")),
  specifications: z.array(specSchema).optional(),
  faqs: z.array(faqSchema).optional(),

  weightGram: z.coerce.number().min(0).optional(),
  dimensions: dimensionsSchema.optional(),
  shippingClass: z.enum(["standard", "fragile", "insured", "free"]).optional(),
  makingCharges: z.coerce.number().min(0).optional(),

  bestseller: z.coerce.boolean().optional(),
  displayOrder: z.coerce.number().optional(),
});

export const updateProductSchema = createProductSchema.partial();

/** Set lifecycle status (admin). */
export const setProductStatusSchema = z.object({
  status: z.enum(["draft", "active", "archived"]),
});

/**
 * Adjust inventory for a product (or a specific variant). Either bump by
 * `delta` or hard-`set` to an absolute value — exactly one is required.
 */
export const adjustStockSchema = z
  .object({
    delta: z.coerce.number().int().optional(),
    set: z.coerce.number().int().min(0).optional(),
    variantSku: z.string().trim().max(80).optional().or(z.literal("")),
    reason: z.string().trim().max(200).optional().or(z.literal("")),
  })
  .refine((v) => v.delta !== undefined || v.set !== undefined, {
    message: "Provide either `delta` or `set`",
  });

/** Bulk action across many products. */
export const bulkSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1, "Provide at least one id"),
    action: z.enum(["status", "delete", "feature"]),
    value: z.union([z.string(), z.boolean()]).optional(),
  })
  .refine(
    (v) =>
      v.action === "delete" ||
      (v.action === "status" && typeof v.value === "string") ||
      (v.action === "feature" && typeof v.value === "boolean"),
    { message: "`value` is required and must match the action" },
  );

/** Reorder payload: an ordered list of product ids (first = displayOrder 1). */
export const reorderProductSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Provide at least one id"),
});

/**
 * Bulk price update across many products. Exactly one `mode` of adjustment:
 *  • "percent"      → change price by ±N% (e.g. -10 = 10% off)
 *  • "amount"       → add/subtract a flat ₹ amount (e.g. +500, -200)
 *  • "set"          → hard-set every selected product to the same price
 * `roundTo` optionally rounds the result (e.g. 10 → nearest ₹10, 99 → .99 ends).
 */
export const bulkPriceSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1, "Provide at least one id"),
    mode: z.enum(["percent", "amount", "set"]),
    value: z.coerce.number(),
    /** Also apply the same change to MRP (keeps discount ratio sane). */
    applyToMrp: z.coerce.boolean().optional(),
    /** Round the resulting price to the nearest multiple of this (₹). */
    roundTo: z.coerce.number().min(0).optional(),
  })
  .refine((v) => (v.mode === "set" ? v.value >= 0 : true), {
    message: "`set` price cannot be negative",
  })
  .refine((v) => (v.mode === "percent" ? v.value > -100 : true), {
    message: "percent discount cannot be 100% or more",
  });

/** Add a single variant to a product's variant matrix. */
export const addVariantSchema = fullVariantSchema;

/** Update a single variant (identified by its SKU) — all fields optional. */
export const updateVariantSchema = fullVariantSchema.partial();

/** Increment view / sold counters (storefront + orders hooks). */
export const incCounterSchema = z.object({
  counter: z.enum(["view", "sold"]),
  by: z.coerce.number().int().min(1).max(1000).optional(),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
export type FullVariantDto = z.infer<typeof fullVariantSchema>;
export type SetProductStatusDto = z.infer<typeof setProductStatusSchema>;
export type AdjustStockDto = z.infer<typeof adjustStockSchema>;
export type BulkProductDto = z.infer<typeof bulkSchema>;
export type ReorderProductDto = z.infer<typeof reorderProductSchema>;
export type BulkPriceDto = z.infer<typeof bulkPriceSchema>;
export type AddVariantDto = z.infer<typeof addVariantSchema>;
export type UpdateVariantDto = z.infer<typeof updateVariantSchema>;
export type IncCounterDto = z.infer<typeof incCounterSchema>;
