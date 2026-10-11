/**
 * Pages (CMS) domain — validation schemas (zod).
 */

import { z } from "zod";

export const createPageSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(120),
  content: z.string().max(200000).optional().or(z.literal("")),
  status: z.enum(["draft", "published"]).optional(),
  seoTitle: z.string().trim().max(70).optional().or(z.literal("")),
  seoDescription: z.string().trim().max(180).optional().or(z.literal("")),
  showInFooter: z.coerce.boolean().optional(),
});

export const updatePageSchema = createPageSchema.partial();

export type CreatePageDto = z.infer<typeof createPageSchema>;
export type UpdatePageDto = z.infer<typeof updatePageSchema>;
