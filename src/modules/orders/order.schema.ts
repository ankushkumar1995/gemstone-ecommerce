/**
 * Orders domain — validation schemas (zod).
 */

import { z } from "zod";

const addressSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().max(24).optional().or(z.literal("")),
  line1: z.string().trim().min(1, "Address is required").max(160),
  line2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required").max(80),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  postalCode: z.string().trim().max(16).optional().or(z.literal("")),
  country: z.string().trim().min(1, "Country is required").max(80),
});

const itemSchema = z.object({
  productId: z.string().trim().min(1),
  variantId: z.string().trim().optional(),
  qty: z.coerce.number().int().min(1, "Quantity must be at least 1"),
});

export const createOrderSchema = z.object({
  customerId: z.string().trim().optional(),
  customer: z
    .object({
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().email(),
      phone: z.string().trim().max(24).optional().or(z.literal("")),
    })
    .optional(),
  items: z.array(itemSchema).min(1, "Add at least one item"),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  paymentMethod: z.enum(["cod", "card", "upi", "netbanking", "manual", "razorpay"]).optional(),
  paymentStatus: z.enum(["unpaid", "paid", "refunded"]).optional(),
  couponCode: z.string().trim().max(40).optional().or(z.literal("")),
  discount: z.coerce.number().min(0).optional(),
  shipping: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  status: z.enum(["pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "refunded"]).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "refunded"]),
});

export const updatePaymentSchema = z.object({
  paymentStatus: z.enum(["unpaid", "paid", "refunded"]),
});

export const updateFulfillmentSchema = z.object({
  courier: z.string().trim().max(80).optional().or(z.literal("")),
  trackingNumber: z.string().trim().max(80).optional().or(z.literal("")),
});

export const addOrderNoteSchema = z.object({
  note: z.string().trim().min(1, "Note cannot be empty").max(1000),
});

export const updateOrderDetailsSchema = z.object({
  shippingAddress: addressSchema.optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;
export type UpdatePaymentDto = z.infer<typeof updatePaymentSchema>;
export type UpdateFulfillmentDto = z.infer<typeof updateFulfillmentSchema>;
export type UpdateOrderDetailsDto = z.infer<typeof updateOrderDetailsSchema>;
