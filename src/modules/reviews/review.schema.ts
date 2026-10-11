/**
 * Reviews domain — validation schemas (zod).
 */

import { z } from "zod";

export const createReviewSchema = z.object({
  productId: z.string().trim().min(1, "Product is required"),
  authorName: z.string().trim().min(2, "Name is too short").max(80),
  authorEmail: z.string().trim().email().optional().or(z.literal("")),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  body: z.string().trim().min(4, "Review is too short").max(2000),
});

export const updateReviewSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  reply: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type CreateReviewDto = z.infer<typeof createReviewSchema>;
export type UpdateReviewDto = z.infer<typeof updateReviewSchema>;
