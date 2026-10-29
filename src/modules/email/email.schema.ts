/** Email module — validation schemas (zod). */

import { z } from "zod";

const eventEnum = z.enum([
  "order_placed",
  "order_shipped",
  "order_delivered",
  "admin_new_order",
  "booking_confirmed",
  "booking_scheduled",
  "booking_completed",
  "welcome",
]);

export const createTemplateSchema = z.object({
  event: eventEnum,
  name: z.string().trim().min(1, "Name is required").max(120),
  enabled: z.coerce.boolean().optional(),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  html: z.string().trim().min(1, "Body is required").max(20000),
  text: z.string().trim().max(10000).optional().or(z.literal("")),
});

export const updateTemplateSchema = createTemplateSchema.partial();

/** Send a test email to verify provider config. */
export const testEmailSchema = z.object({
  to: z.string().trim().email("Valid recipient email required"),
});

export type CreateTemplateDto = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateDto = z.infer<typeof updateTemplateSchema>;
export type TestEmailDto = z.infer<typeof testEmailSchema>;
