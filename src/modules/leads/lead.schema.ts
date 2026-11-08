/**
 * Leads domain — validation schemas (zod).
 *
 * Untrusted input (API request bodies) is validated against these before it
 * ever reaches the service. The inferred types are kept in sync with
 * `lead.types.ts` via the shared field definitions.
 */

import { z } from "zod";

export const createLeadSchema = z
  .object({
  source: z.enum(["contact", "service", "newsletter", "consultation"]),
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
  gender: z.enum(["male", "female", "other"]).optional(),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed", "separated"]).optional(),
  astrologer: z.string().trim().max(80).optional(),
  })
  // A consultation request must say who is asking and how to reach them.
  .superRefine((v, ctx) => {
    if (v.source !== "consultation") return;
    if (!v.phone) ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid phone" });
    if (!v.gender) ctx.addIssue({ code: "custom", path: ["gender"], message: "Please select your gender" });
    if (!v.maritalStatus) ctx.addIssue({ code: "custom", path: ["maritalStatus"], message: "Please select your marital status" });
  });

export type CreateLeadDto = z.infer<typeof createLeadSchema>;
