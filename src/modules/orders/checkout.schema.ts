/**
 * Customer checkout input (app + website). Only ids, quantities, configurator
 * choices, coupon code and the address are accepted; every price, discount,
 * shipping, tax and status is decided on the server.
 */
import { z } from "zod";
import { configSelectionSchema } from "@/modules/configurator/configurator.schema";

export const cartLineSchema = z.object({
  productId: z.string().trim().min(1).max(40),
  /** Variant SKU (when the product has options). */
  variantId: z.string().trim().max(80).optional().or(z.literal("").transform(() => undefined)),
  qty: z.coerce.number().int().min(1, "Quantity must be at least 1").max(99),
  config: configSelectionSchema.optional(),
});

export const quoteSchema = z.object({
  items: z.array(cartLineSchema).min(1, "Your cart is empty").max(30),
  couponCode: z.string().trim().max(40).optional().or(z.literal("")),
});

const shippingAddressSchema = z.object({
  name: z.string().trim().min(2, "Enter the receiver's name").max(120),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  line1: z.string().trim().min(4, "Enter the house / street address").max(160),
  line2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Enter the city").max(80),
  state: z.string().trim().min(2, "Enter the state").max(80),
  postalCode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a 6-digit PIN code"),
  country: z.string().trim().max(80).optional().default("India"),
});

export const placeOrderSchema = quoteSchema.extend({
  shippingAddress: shippingAddressSchema,
  method: z.enum(["cod", "online"]),
  /** Same id on a retry = the same order. */
  requestId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,64}$/, "Invalid request id"),
  contact: z.object({
    name: z.string().trim().max(120).optional(),
    email: z.string().trim().email("Enter a valid email address").max(180).optional().or(z.literal("")),
    phone: z.string().trim().max(24).optional(),
  }).optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type PlaceOrderDto = z.infer<typeof placeOrderSchema>;
