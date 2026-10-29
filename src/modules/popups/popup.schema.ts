/**
 * Popups domain — validation schemas (zod). The zod schema is the source of
 * truth for the admin DTO shape; the Mongoose model just persists it.
 */

import { z } from "zod";

const ctaSchema = z.object({
  label: z.string().trim().max(60),
  href: z.string().trim().max(400),
  style: z.enum(["primary", "secondary", "ghost"]).default("primary"),
});

const contentSchema = z.object({
  heading: z.string().trim().max(160).optional().or(z.literal("")),
  body: z.string().trim().max(2000).optional().or(z.literal("")),
  image: z.string().trim().max(600).optional().or(z.literal("")),
  html: z.string().trim().max(10000).optional().or(z.literal("")),
  couponCode: z.string().trim().max(40).optional().or(z.literal("")),
  emailPlaceholder: z.string().trim().max(80).optional().or(z.literal("")),
  submitLabel: z.string().trim().max(60).optional().or(z.literal("")),
  successMessage: z.string().trim().max(300).optional().or(z.literal("")),
  ctas: z.array(ctaSchema).max(2).default([]),
});

const designSchema = z.object({
  layout: z.enum(["center", "corner", "top-bar", "bottom-bar", "fullscreen"]).default("center"),
  corner: z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]).default("bottom-right"),
  width: z.enum(["sm", "md", "lg"]).default("md"),
  radius: z.enum(["none", "soft", "round"]).default("soft"),
  imageOnly: z.coerce.boolean().default(false),
  accentColor: z.string().trim().max(32).optional().or(z.literal("")),
  backgroundColor: z.string().trim().max(32).optional().or(z.literal("")),
  textColor: z.string().trim().max(32).optional().or(z.literal("")),
  overlay: z.coerce.boolean().default(true),
  showClose: z.coerce.boolean().default(true),
  closeOnOverlayClick: z.coerce.boolean().default(true),
  closeOnEsc: z.coerce.boolean().default(true),
});

const targetingSchema = z.object({
  pageMode: z.enum(["all", "include", "exclude"]).default("all"),
  pagePaths: z.array(z.string().trim().max(200)).max(50).default([]),
  device: z.enum(["all", "desktop", "mobile"]).default("all"),
  audience: z.enum(["all", "new", "returning"]).default("all"),
  auth: z.enum(["all", "guest", "customer"]).default("all"),
});

const triggerSchema = z.object({
  type: z.enum(["delay", "scroll", "exit-intent", "load"]).default("delay"),
  delaySeconds: z.coerce.number().min(0).max(600).default(3),
  scrollPercent: z.coerce.number().min(0).max(100).default(50),
});

const frequencySchema = z.object({
  frequency: z
    .enum(["once-ever", "once-per-session", "once-per-day", "once-per-n-days", "every-visit"])
    .default("once-per-session"),
  everyNDays: z.coerce.number().int().min(1).max(365).default(7),
  showAgainAfterDismissHours: z.coerce.number().min(0).max(8760).default(0),
});

export const createPopupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  type: z.enum(["promo", "newsletter", "lead", "announcement", "html"]),
  enabled: z.coerce.boolean().optional(),
  priority: z.coerce.number().int().min(0).max(9999).optional(),
  content: contentSchema,
  design: designSchema,
  targeting: targetingSchema,
  trigger: triggerSchema,
  frequencyRule: frequencySchema,
  startAt: z.string().trim().optional().or(z.literal("")),
  endAt: z.string().trim().optional().or(z.literal("")),
});

export const updatePopupSchema = createPopupSchema.partial();

/** Public submission (newsletter / lead popup). */
export const popupSubmissionSchema = z.object({
  popupId: z.string().trim().min(1),
  email: z.string().trim().email("Valid email required"),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

/** Public analytics event. */
export const popupEventSchema = z.object({
  popupId: z.string().trim().min(1),
  event: z.enum(["impression", "click", "dismiss", "submission"]),
});

export type CreatePopupDto = z.infer<typeof createPopupSchema>;
export type UpdatePopupDto = z.infer<typeof updatePopupSchema>;
export type PopupSubmissionDto = z.infer<typeof popupSubmissionSchema>;
export type PopupEventDto = z.infer<typeof popupEventSchema>;
