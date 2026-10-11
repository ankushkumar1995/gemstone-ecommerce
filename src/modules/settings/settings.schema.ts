/**
 * Settings domain — validation schemas (zod). The update is a deep-partial so
 * the admin can save a single tab without resending the whole document.
 */

import { z } from "zod";

const generalSchema = z.object({
  storeName: z.string().trim().min(1, "Store name is required").max(80),
  tagline: z.string().trim().max(160).optional().or(z.literal("")),
  logo: z.string().trim().optional().or(z.literal("")),
  supportEmail: z.string().trim().email().optional().or(z.literal("")),
  supportPhone: z.string().trim().max(24).optional().or(z.literal("")),
  whatsappNumber: z.string().trim().max(24).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  timezone: z.string().trim().min(1).max(60),
});

const zoneSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  rate: z.coerce.number().min(0),
  freeAbove: z.coerce.number().min(0).optional(),
});

const shippingSchema = z.object({
  freeShippingThreshold: z.coerce.number().min(0),
  flatRate: z.coerce.number().min(0),
  deliveryEstimate: z.string().trim().max(80).optional().or(z.literal("")),
  zones: z.array(zoneSchema),
});

const taxSchema = z.object({
  rate: z.coerce.number().min(0).max(100),
  gstin: z.string().trim().max(20).optional().or(z.literal("")),
  inclusive: z.coerce.boolean(),
});

const localizationSchema = z.object({
  defaultCurrency: z.string().trim().min(1).max(8),
  enabledCurrencies: z.array(z.string()).min(1, "Enable at least one currency"),
  numberFormat: z.enum(["en-IN", "en-US", "en-GB"]),
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
});

const paymentsSchema = z.object({
  methods: z.object({
    cod: z.coerce.boolean(),
    card: z.coerce.boolean(),
    upi: z.coerce.boolean(),
    netbanking: z.coerce.boolean(),
  }),
  gateway: z.enum(["none", "razorpay", "stripe"]),
  razorpayKeyId: z.string().trim().max(80).optional().or(z.literal("")),
  stripePublishableKey: z.string().trim().max(120).optional().or(z.literal("")),
});

const checkoutSchema = z.object({
  guestCheckout: z.coerce.boolean(),
  requirePhone: z.coerce.boolean(),
  minOrderValue: z.coerce.number().min(0),
  termsText: z.string().trim().max(2000).optional().or(z.literal("")),
});

const notificationsSchema = z.object({
  adminAlertEmail: z.string().trim().email().optional().or(z.literal("")),
  sendOrderConfirmation: z.coerce.boolean(),
  sendShippingUpdate: z.coerce.boolean(),
  orderConfirmationTemplate: z.string().trim().max(4000).optional().or(z.literal("")),
});

const seoSchema = z.object({
  metaTitle: z.string().trim().max(70).optional().or(z.literal("")),
  metaDescription: z.string().trim().max(180).optional().or(z.literal("")),
  ogImage: z.string().trim().optional().or(z.literal("")),
  instagram: z.string().trim().max(120).optional().or(z.literal("")),
  facebook: z.string().trim().max(120).optional().or(z.literal("")),
  youtube: z.string().trim().max(120).optional().or(z.literal("")),
  googleAnalyticsId: z.string().trim().max(40).optional().or(z.literal("")),
});

const teamMemberSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  role: z.enum(["admin", "manager", "staff"]),
});

const teamSchema = z.object({
  members: z.array(teamMemberSchema),
});

const appearanceSchema = z.object({
  accentColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #c9942a"),
  secondaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #6a2ee0"),
  fontFamily: z.enum(["Inter", "Poppins", "Manrope", "DM Sans"]),
  borderRadius: z.enum(["sharp", "soft", "round"]),
});

const inventorySchema = z.object({
  lowStockThreshold: z.coerce.number().int().min(0),
  outOfStockBehaviour: z.enum(["hide", "show_sold_out", "allow_backorder"]),
  stockDisplay: z.enum(["exact", "in_out", "hidden"]),
  skuPattern: z.string().trim().max(40),
});

const orderSchema = z.object({
  numberPrefix: z.string().trim().min(1).max(8),
  autoCancelUnpaidHours: z.coerce.number().int().min(0).max(720),
  minQtyPerItem: z.coerce.number().int().min(1),
  maxQtyPerItem: z.coerce.number().int().min(0),
});

const emailSchema = z.object({
  fromName: z.string().trim().min(1).max(80),
  fromEmail: z.string().trim().email(),
  replyTo: z.string().trim().email().optional().or(z.literal("")),
  smtpHost: z.string().trim().max(120).optional().or(z.literal("")),
  smtpPort: z.coerce.number().int().min(0).max(65535).optional(),
  smtpUser: z.string().trim().max(120).optional().or(z.literal("")),
  smtpConfigured: z.coerce.boolean(),
});

export const updateSettingsSchema = z.object({
  general: generalSchema.partial().optional(),
  shipping: shippingSchema.partial().optional(),
  tax: taxSchema.partial().optional(),
  localization: localizationSchema.partial().optional(),
  payments: paymentsSchema.partial().optional(),
  checkout: checkoutSchema.partial().optional(),
  notifications: notificationsSchema.partial().optional(),
  seo: seoSchema.partial().optional(),
  team: teamSchema.partial().optional(),
  appearance: appearanceSchema.partial().optional(),
  inventory: inventorySchema.partial().optional(),
  order: orderSchema.partial().optional(),
  email: emailSchema.partial().optional(),
});

export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
