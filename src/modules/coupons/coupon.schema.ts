/**
 * Coupons domain — validation schemas (zod).
 */

import { z } from "zod";

export const createCouponSchema = z.object({
  code: z.string().trim().min(2, "Code is too short").max(30),
  description: z.string().trim().max(160).optional().or(z.literal("")),
  type: z.enum(["percentage", "fixed"]),
  value: z.coerce.number().min(0),
  minCartValue: z.coerce.number().min(0).optional(),
  maxDiscount: z.coerce.number().min(0).optional(),
  usageLimit: z.coerce.number().int().min(0).optional(),
  startsAt: z.string().trim().optional().or(z.literal("")),
  expiresAt: z.string().trim().optional().or(z.literal("")),
  active: z.coerce.boolean().optional(),
});

export const updateCouponSchema = createCouponSchema.partial();

export const applyCouponSchema = z.object({
  code: z.string().trim().min(1, "Enter a coupon code"),
  cartSubtotal: z.coerce.number().min(0),
});

export type CreateCouponDto = z.infer<typeof createCouponSchema>;
export type UpdateCouponDto = z.infer<typeof updateCouponSchema>;
export type ApplyCouponDto = z.infer<typeof applyCouponSchema>;
