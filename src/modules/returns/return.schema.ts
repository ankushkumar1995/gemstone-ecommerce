/**
 * Returns (RMA) domain — validation schemas (zod).
 */

import { z } from "zod";

const itemSchema = z.object({
  productId: z.string().trim().min(1),
  variantId: z.string().trim().optional(),
  qty: z.coerce.number().int().min(1),
});

export const createReturnSchema = z.object({
  orderId: z.string().trim().min(1, "Order is required"),
  items: z.array(itemSchema).min(1, "Select at least one item"),
  reason: z.enum(["damaged", "not_as_described", "wrong_item", "changed_mind", "quality", "other"]),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
  restock: z.coerce.boolean().optional(),
});

export const updateReturnStatusSchema = z.object({
  status: z.enum(["requested", "approved", "received", "refunded", "rejected"]),
  refundAmount: z.coerce.number().min(0).optional(),
  restock: z.coerce.boolean().optional(),
});

export const addReturnNoteSchema = z.object({
  note: z.string().trim().min(1).max(1000),
});

export type CreateReturnDto = z.infer<typeof createReturnSchema>;
export type UpdateReturnStatusDto = z.infer<typeof updateReturnStatusSchema>;
export type AddReturnNoteDto = z.infer<typeof addReturnNoteSchema>;
