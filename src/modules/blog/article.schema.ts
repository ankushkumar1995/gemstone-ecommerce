/**
 * Blog domain — validation schemas (zod).
 */

import { z } from "zod";

const blockSchema = z.object({
  type: z.enum(["p", "h2", "quote", "list"]),
  text: z.string().max(4000).optional(),
  items: z.array(z.string().max(500)).optional(),
});

const seoSchema = z.object({
  metaTitle: z.string().trim().max(70).optional().or(z.literal("")),
  metaDescription: z.string().trim().max(180).optional().or(z.literal("")),
  ogImage: z.string().trim().optional().or(z.literal("")),
});

export const createArticleSchema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(140),
  excerpt: z.string().trim().max(300).optional().or(z.literal("")),
  category: z.string().trim().min(1, "Category is required").max(60),
  readMins: z.coerce.number().int().min(1).max(120).optional(),
  image: z.string().trim().optional().or(z.literal("")),
  author: z.string().trim().max(80).optional().or(z.literal("")),
  authorRole: z.string().trim().max(80).optional().or(z.literal("")),
  date: z.string().trim().optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
  featured: z.coerce.boolean().optional(),
  body: z.array(blockSchema).optional(),
  content: z.string().max(100000).optional().or(z.literal("")),
  status: z.enum(["draft", "published"]).optional(),
  seo: seoSchema.optional(),
});

export const updateArticleSchema = createArticleSchema.partial();

export type CreateArticleDto = z.infer<typeof createArticleSchema>;
export type UpdateArticleDto = z.infer<typeof updateArticleSchema>;
