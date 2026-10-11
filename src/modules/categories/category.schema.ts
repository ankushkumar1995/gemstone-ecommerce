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
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;
