/**
 * Collections domain — validation schemas (zod).
 */

import { z } from "zod";

export const createCollectionSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(80),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  image: z.string().trim().optional().or(z.literal("")),
  featured: z.coerce.boolean().optional(),
});

export const updateCollectionSchema = createCollectionSchema.partial();

export type CreateCollectionDto = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionDto = z.infer<typeof updateCollectionSchema>;
