/**
 * Customers domain — validation schemas (zod).
 */

import { z } from "zod";

const addressSchema = z.object({
  label: z.string().trim().min(1).max(40),
  line1: z.string().trim().min(1, "Address is required").max(160),
  line2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required").max(80),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  postalCode: z.string().trim().max(16).optional().or(z.literal("")),
  country: z.string().trim().min(1, "Country is required").max(80),
  isDefault: z.coerce.boolean().optional(),
});

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(120),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(24).optional().or(z.literal("")),
  avatar: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["active", "vip", "blocked"]).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  addresses: z.array(addressSchema).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;
