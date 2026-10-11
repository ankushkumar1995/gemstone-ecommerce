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

export const createProductSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(120),
  // category is a dynamic slug managed by the categories module
  category: z.string().trim().min(1, "Category is required"),
  price: z.coerce.number().min(0, "Price must be ≥ 0"),
  mrp: z.coerce.number().min(0, "MRP must be ≥ 0"),
  image: z.string().trim().optional(),
  images: z.array(z.string()).optional(),
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
      benefits: z.array(z.string()).optional(),
    })
    .optional(),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
