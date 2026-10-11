/**
 * Services domain — validation schemas (zod).
 */

import { z } from "zod";

/** lucide icon names allowed for a service (resolved in the storefront). */
export const SERVICE_ICONS = [
  "ScrollText",
  "Gem",
  "HeartHandshake",
  "TrendingUp",
  "Home",
  "CalendarClock",
  "Hash",
  "PhoneCall",
  "Sparkles",
  "Star",
  "Moon",
  "Sun",
] as const;

export const createServiceSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(80),
  tagline: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(600).optional().or(z.literal("")),
  icon: z.enum(SERVICE_ICONS).optional(),
  priceFrom: z.coerce.number().min(0),
  duration: z.string().trim().max(40).optional().or(z.literal("")),
  popular: z.coerce.boolean().optional(),
  features: z.array(z.string().trim().max(160)).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  order: z.coerce.number().int().min(0).optional(),
});

export const updateServiceSchema = createServiceSchema.partial();

export type CreateServiceDto = z.infer<typeof createServiceSchema>;
export type UpdateServiceDto = z.infer<typeof updateServiceSchema>;
