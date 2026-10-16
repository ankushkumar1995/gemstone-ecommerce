/**
 * Categories domain — validation schemas (zod).
 */

import { z } from "zod";

export const createCategorySchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(80),
  tagline: z.string().trim().max(160).optional().or(z.literal("")),
  image: z.string().trim().optional().or(z.literal("")),
  tint: z.string().trim().max(240).optional().or(z.literal("")),
  order: z.coerce.number().int().min(0).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

/** Reorder payload: an ordered list of category ids. */
export const reorderCategorySchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Provide at least one id"),
});

export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;
export type ReorderCategoryDto = z.infer<typeof reorderCategorySchema>;
