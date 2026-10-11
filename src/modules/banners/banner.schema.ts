/**
 * Banners domain — validation schemas (zod).
 */

import { z } from "zod";

export const createBannerSchema = z.object({
  placement: z.enum(["hero", "promo", "strip"]),
  eyebrow: z.string().trim().max(60).optional().or(z.literal("")),
  title: z.string().trim().min(1, "Title is required").max(120),
  subtitle: z.string().trim().max(300).optional().or(z.literal("")),
  image: z.string().trim().optional().or(z.literal("")),
  ctaLabel: z.string().trim().max(40).optional().or(z.literal("")),
  ctaHref: z.string().trim().max(200).optional().or(z.literal("")),
  order: z.coerce.number().int().min(0).optional(),
  active: z.coerce.boolean().optional(),
  startsAt: z.string().trim().optional().or(z.literal("")),
  endsAt: z.string().trim().optional().or(z.literal("")),
});

export const updateBannerSchema = createBannerSchema.partial();

export type CreateBannerDto = z.infer<typeof createBannerSchema>;
export type UpdateBannerDto = z.infer<typeof updateBannerSchema>;
