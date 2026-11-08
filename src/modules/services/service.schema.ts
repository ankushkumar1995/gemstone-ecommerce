/**
 * Services domain — validation schemas (zod).
 */

import { z } from "zod";

/** lucide icon names allowed for a service (resolved in the storefront). */
export const SERVICE_ICONS = [
  "ScrollText",
  "Gem",
  "HeartHandshake",
  "TrendingUp",
  "Home",
  "CalendarClock",
  "Hash",
  "PhoneCall",
  "Sparkles",
  "Star",
  "Moon",
  "Sun",
] as const;

export const createServiceSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(80),
  tagline: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(20000).optional().or(z.literal("")),
  icon: z.enum(SERVICE_ICONS).optional(),
  image: z.string().trim().max(600).optional().or(z.literal("")),
  priceFrom: z.coerce.number().min(0),
  duration: z.string().trim().max(40).optional().or(z.literal("")),
  popular: z.coerce.boolean().optional(),
  features: z.array(z.string().trim().max(160)).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  order: z.coerce.number().int().min(0).optional(),
  /** null / omitted = Uncategorised. */
  categoryId: z.string().trim().max(40).nullable().optional(),
});

export const updateServiceSchema = createServiceSchema.partial();

export type CreateServiceDto = z.infer<typeof createServiceSchema>;
export type UpdateServiceDto = z.infer<typeof updateServiceSchema>;

/* ---------------- service categories ---------------- */
const CAT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createServiceCategorySchema = z.object({
  name: z.string().trim().min(2, "Category name is required").max(60),
  slug: z.string().trim().toLowerCase().max(70).refine((v) => v === "" || CAT_SLUG_RE.test(v), "Use lowercase letters, numbers and dashes").optional(),
  icon: z.enum(SERVICE_ICONS).optional(),
  description: z.string().trim().max(300).optional(),
  visible: z.boolean().optional(),
});
export const updateServiceCategorySchema = z.object({
  name: z.string().trim().min(2, "Category name is required").max(60),
  slug: z.string().trim().toLowerCase().max(70).regex(CAT_SLUG_RE, "Use lowercase letters, numbers and dashes"),
  icon: z.enum(SERVICE_ICONS),
  description: z.string().trim().max(300),
  visible: z.boolean(),
});
export const reorderServiceCategoriesSchema = z.object({ ids: z.array(z.string().trim().min(1).max(40)).min(1).max(200) })
  .refine((v) => new Set(v.ids).size === v.ids.length, "A category is listed twice");
/** Delete: services in it move to `moveTo` (another category id) or to Uncategorised (null). */
export const deleteServiceCategorySchema = z.object({ moveTo: z.string().trim().max(40).nullable().optional() });

export type CreateServiceCategoryDto = z.infer<typeof createServiceCategorySchema>;
export type UpdateServiceCategoryDto = z.infer<typeof updateServiceCategorySchema>;
