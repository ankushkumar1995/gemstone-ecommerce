/**
 * Customer self-service account validation schemas (zod).
 * Used by /api/v1/account/{profile,addresses,wishlist}.
 */

import { z } from "zod";

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Please enter your name").max(120).optional(),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
  })
  .refine((v) => v.name !== undefined || v.phone !== undefined, {
    message: "Nothing to update",
  });

export const addressSchema = z.object({
  label: z.string().trim().max(40).optional().or(z.literal("")),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  line1: z.string().trim().min(1, "Address is required").max(200),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required").max(80),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  isDefault: z.coerce.boolean().optional(),
});

export const wishlistSchema = z.object({
  productId: z.string().trim().min(1, "Product id is required").max(120),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type AddressDto = z.infer<typeof addressSchema>;
export type WishlistDto = z.infer<typeof wishlistSchema>;
