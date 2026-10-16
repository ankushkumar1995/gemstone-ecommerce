/**
 * Coupons domain — validation schemas (zod).
 */

import { z } from "zod";

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "Code is too short")
      .max(40)
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Code: letters/digits only (– and _ allowed, no spaces)"),
    description: z.string().trim().max(200).optional().or(z.literal("")),
    type: z.enum(["percentage", "fixed"]),
    value: z.coerce.number().min(0),
    minCartValue: z.coerce.number().min(0).optional(),
    maxDiscount: z.coerce.number().min(0).optional(),
    usageLimit: z.coerce.number().int().min(0).optional(),
    perCustomerLimit: z.coerce.number().int().min(0).optional(),
    startsAt: z.string().trim().optional().or(z.literal("")),
    expiresAt: z.string().trim().optional().or(z.literal("")),
    active: z.coerce.boolean().optional(),
    isPublic: z.coerce.boolean().optional(),
  })
  // A percentage coupon must be 1–100.
  .refine((v) => v.type !== "percentage" || (v.value > 0 && v.value <= 100), {
    message: "Percentage must be between 1 and 100",
    path: ["value"],
  })
  // A fixed coupon must be a positive amount.
  .refine((v) => v.type !== "fixed" || v.value > 0, {
    message: "Fixed discount must be greater than 0",
    path: ["value"],
  })
  // expiry must be after start (when both set).
  .refine(
    (v) => !v.startsAt || !v.expiresAt || new Date(v.expiresAt).getTime() > new Date(v.startsAt).getTime(),
    { message: "Expiry must be after the start date", path: ["expiresAt"] },
  );

// `.partial()` isn't available on a refined object; rebuild a partial variant.
export const updateCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Code: letters/digits only (– and _ allowed, no spaces)")
      .optional(),
    description: z.string().trim().max(200).optional().or(z.literal("")),
    type: z.enum(["percentage", "fixed"]).optional(),
    value: z.coerce.number().min(0).optional(),
    minCartValue: z.coerce.number().min(0).optional(),
    maxDiscount: z.coerce.number().min(0).optional(),
    usageLimit: z.coerce.number().int().min(0).optional(),
    perCustomerLimit: z.coerce.number().int().min(0).optional(),
    startsAt: z.string().trim().optional().or(z.literal("")),
    expiresAt: z.string().trim().optional().or(z.literal("")),
    active: z.coerce.boolean().optional(),
    isPublic: z.coerce.boolean().optional(),
  })
  .refine((v) => v.value === undefined || v.type !== "percentage" || (v.value > 0 && v.value <= 100), {
    message: "Percentage must be between 1 and 100",
    path: ["value"],
  });

export const applyCouponSchema = z.object({
  code: z.string().trim().min(1, "Enter a coupon code"),
  cartSubtotal: z.coerce.number().min(0),
  customerId: z.string().trim().optional(),
});

export const toggleCouponSchema = z.object({
  active: z.coerce.boolean(),
});

export type CreateCouponDto = z.infer<typeof createCouponSchema>;
export type UpdateCouponDto = z.infer<typeof updateCouponSchema>;
export type ApplyCouponDto = z.infer<typeof applyCouponSchema>;
