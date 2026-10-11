/**
 * Leads domain — validation schemas (zod).
 *
 * Untrusted input (API request bodies) is validated against these before it
 * ever reaches the service. The inferred types are kept in sync with
 * `lead.types.ts` via the shared field definitions.
 */

import { z } from "zod";

export const createLeadSchema = z.object({
  source: z.enum(["contact", "service", "newsletter"]),
  name: z.string().trim().min(2, "Name is too short").max(80),
  email: z.string().trim().email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone")
    .max(20)
    .optional()
    .or(z.literal("")),
  topic: z.string().trim().max(120).optional(),
  message: z.string().trim().max(2000).optional(),
  birth: z
    .object({
      date: z.string().optional(),
      time: z.string().optional(),
      place: z.string().max(120).optional(),
    })
    .optional(),
});

export type CreateLeadDto = z.infer<typeof createLeadSchema>;
