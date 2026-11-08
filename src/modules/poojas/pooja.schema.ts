/**
 * Poojas — request validation. Everything the admin sends is checked here;
 * cross-field rules (unique ids, sorted tiers, valid dates) use superRefine so
 * the admin sees exactly which field is wrong.
 */

import { z } from "zod";
import { ADDON_KINDS, BOOKING_STATUSES, CATEGORY_ICONS, HAVAN_MODES, LOCATION_MODES, PACKAGE_KINDS, POOJA_STATUSES, PRASAD_STATUSES, RITUAL_TYPES, SCHEDULE_MODES, blankHavan } from "./pooja.types";
import { isDate, isTime } from "./pooja.rules";

const str = (max: number) => z.string().trim().max(max);
const money = z.number().int("Use whole rupees").min(0).max(10_000_000);
const id = z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/, "Invalid id");
const url = z.string().trim().max(500).refine((v) => v === "" || /^https:\/\//i.test(v) || v.startsWith("/"), "Use an https:// link");
const date = z.string().refine(isDate, "Use a valid date (YYYY-MM-DD)");
const time = z.string().refine(isTime, "Use a valid time (HH:MM)");

const packageSchema = z.object({
  id, name: str(80).min(2, "Package name is required"), kind: z.enum(PACKAGE_KINDS),
  members: z.number().int().min(1).max(25), price: money, mrp: money.nullable(),
  description: str(300), perks: z.array(str(120)).max(12), popular: z.boolean(), active: z.boolean(),
  // Havan tiers (optional; poojas leave them empty).
  jaapCount: z.number().int().min(1).max(100_000_000).nullable().optional(),
  ahutiCount: z.number().int().min(1).max(10_000_000).nullable().optional(),
  panditCount: z.number().int().min(1).max(108).nullable().optional(),
}).refine((p) => p.mrp === null || p.mrp === 0 || p.mrp > p.price, { message: "MRP must be higher than the price", path: ["mrp"] });

const havanSchema = z.object({
  mode: z.enum(HAVAN_MODES),
  durationDays: z.number().int().min(1, "At least 1 day").max(41, "At most 41 days"),
  kundCount: z.number().int().min(1).max(108),
  liveUrl: url,
  samagri: z.array(str(80)).max(30),
  deliverables: z.array(str(120)).max(20),
});

const addOnSchema = z.object({
  id, name: str(80).min(2, "Add-on name is required"), kind: z.enum(ADDON_KINDS), description: str(300),
  price: money, maxQty: z.number().int().min(1).max(108), requiresAddress: z.boolean(), active: z.boolean(),
});

const fixedDateSchema = z.object({
  id, date, time, label: str(60), capacity: z.number().int().min(1).max(100_000).nullable(), priceDelta: z.number().int().min(-1_000_000).max(1_000_000),
});

const scheduleSchema = z.object({
  mode: z.enum(SCHEDULE_MODES),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  times: z.array(time).max(12),
  fixedDates: z.array(fixedDateSchema).max(200),
  slotCapacity: z.number().int().min(1).max(100_000),
  cutoffHours: z.number().int().min(0).max(720),
  advanceDays: z.number().int().min(1).max(365),
  blackoutDates: z.array(date).max(366),
}).superRefine((s, ctx) => {
  if (new Set(s.weekdays).size !== s.weekdays.length) ctx.addIssue({ code: "custom", message: "A weekday is repeated", path: ["weekdays"] });
  if (new Set(s.times).size !== s.times.length) ctx.addIssue({ code: "custom", message: "A time is repeated", path: ["times"] });
  const keys = s.fixedDates.map((f) => `${f.date}T${f.time}`);
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: "custom", message: "The same date and time is added twice", path: ["fixedDates"] });
});

const policySchema = z.object({
  freeRescheduleHours: z.number().int().min(0).max(720),
  maxReschedules: z.number().int().min(0).max(10),
  refundTiers: z.array(z.object({ hoursBefore: z.number().int().min(0).max(2160), refundPct: z.number().int().min(0).max(100) })).max(6),
  proofSlaHours: z.number().int().min(1).max(720),
  prasadDispatchDays: z.number().int().min(0).max(60),
}).superRefine((p, ctx) => {
  const hrs = p.refundTiers.map((t) => t.hoursBefore);
  if (new Set(hrs).size !== hrs.length) ctx.addIssue({ code: "custom", message: "Two refund rules use the same hours", path: ["refundTiers"] });
  const sorted = [...p.refundTiers].sort((a, b) => b.hoursBefore - a.hoursBefore);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].refundPct > sorted[i - 1].refundPct) ctx.addIssue({ code: "custom", message: "Refund % cannot go up closer to the pooja", path: ["refundTiers"] });
  }
});

export const poojaInputSchema = z.object({
  // Old clients that don't send these get a normal pooja.
  type: z.enum(RITUAL_TYPES).default("pooja"),
  havan: havanSchema.default(blankHavan),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes").max(90).optional(),
  title: str(120).min(3, "Title is required"),
  subtitle: str(160), deity: str(60), category: z.string().trim().regex(/^[a-z0-9_-]{2,60}$/, "Choose a category"), tags: z.array(str(30)).max(15),
  shortDescription: str(300), description: str(20_000),
  benefits: z.array(str(200)).max(20), vidhi: z.array(str(300)).max(30), includes: z.array(str(200)).max(20),
  faqs: z.array(z.object({ q: str(200).min(3), a: str(1000).min(2) })).max(20),
  coverImage: url, gallery: z.array(url).max(12), videoUrl: url,
  location: z.object({ mode: z.enum(LOCATION_MODES), place: str(120), city: str(60), state: str(60), mapUrl: url }),
  durationMin: z.number().int().min(10).max(1440), panditCount: z.number().int().min(1).max(51), mantraCount: z.number().int().min(0).max(10_000_000),
  packages: z.array(packageSchema).max(8), addOns: z.array(addOnSchema).max(15),
  schedule: scheduleSchema, policy: policySchema,
  sankalp: z.object({
    requireGotra: z.boolean(), requireDob: z.boolean(), requireBirthPlace: z.boolean(), requireWish: z.boolean(), askRelation: z.boolean(),
    wishMaxLength: z.number().int().min(50).max(2000), defaultGotra: str(40), instructions: str(500),
  }),
  seo: z.object({ title: str(70), description: str(170) }),
  status: z.enum(POOJA_STATUSES), featured: z.boolean(), sortOrder: z.number().int().min(-1000).max(100_000),
}).superRefine((p, ctx) => {
  const pk = p.packages.map((x) => x.id);
  if (new Set(pk).size !== pk.length) ctx.addIssue({ code: "custom", message: "Package ids must be unique", path: ["packages"] });
  const ad = p.addOns.map((x) => x.id);
  if (new Set(ad).size !== ad.length) ctx.addIssue({ code: "custom", message: "Add-on ids must be unique", path: ["addOns"] });
  if (p.packages.filter((x) => x.popular).length > 1) ctx.addIssue({ code: "custom", message: "Only one package can be marked popular", path: ["packages"] });
  if (p.type === "havan") {
    // Ekal = one yajman per date: each date can hold only one booking.
    if (p.havan.mode === "ekal" && p.schedule.slotCapacity !== 1) ctx.addIssue({ code: "custom", message: "Ekal havan is for one yajman, so each date takes 1 booking", path: ["schedule", "slotCapacity"] });
    // A multi-day anushthan must fit before the next start on the same weekly time.
    if (p.havan.durationDays > p.schedule.advanceDays) ctx.addIssue({ code: "custom", message: "Duration is longer than the booking window", path: ["havan", "durationDays"] });
  }
});
export type PoojaInput = z.infer<typeof poojaInputSchema>;

export const panditInputSchema = z.object({
  name: str(80).min(2, "Name is required"),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile"),
  email: z.string().trim().max(120).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email"),
  city: str(60), languages: z.array(str(30)).max(10), poojaIds: z.array(z.string().trim().max(40)).max(200),
  experienceYears: z.number().int().min(0).max(80), photo: url, maxPerDay: z.number().int().min(1).max(100),
  active: z.boolean(), notes: str(2000),
});
export type PanditInput = z.infer<typeof panditInputSchema>;

const memberSchema = z.object({ name: str(80).min(2, "Member name is required"), relation: str(40), gotra: str(40), dob: z.string().trim().refine((v) => v === "" || isDate(v), "Invalid date of birth"), birthPlace: str(80) });
const addressSchema = z.object({
  name: str(80).min(2), phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile"),
  line1: str(160).min(4), line2: str(160), city: str(60).min(2), state: str(60).min(2), postalCode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a 6-digit PIN code"),
});

/** Admin-created booking (phone / walk-in / complimentary). */
export const adminBookingSchema = z.object({
  poojaId: z.string().trim().min(1),
  packageId: z.string().trim().min(1),
  date, time: z.string().refine((v) => v === "any" || isTime(v), "Invalid time"),
  addOns: z.array(z.object({ id: z.string().trim().min(1), qty: z.number().int().min(1).max(108) })).max(15),
  customer: z.object({ name: str(80).min(2), email: z.string().trim().max(120).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email"), phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile") }),
  members: z.array(memberSchema).min(1).max(25),
  wish: str(2000),
  address: addressSchema.nullable(),
  payment: z.object({ method: z.enum(["manual", "free"]), reference: str(120), paid: z.boolean() }),
  discount: money,
  allowOverbook: z.boolean(),
  ignoreCutoff: z.boolean(),
  requestId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,64}$/, "Invalid request id"),
});
export type AdminBookingInput = z.infer<typeof adminBookingSchema>;

/**
 * Customer booking request from the website. No payment here: the booking is
 * saved as "payment pending" and the team calls to confirm. Price, discount,
 * overbooking and cutoff are never taken from the client.
 */
export const webBookingSchema = z.object({
  poojaId: z.string().trim().min(1).max(40),
  packageId: z.string().trim().min(1).max(40),
  date, time: z.string().refine((v) => v === "any" || isTime(v), "Choose a time"),
  addOns: z.array(z.object({ id: z.string().trim().min(1).max(40), qty: z.number().int().min(1).max(108) })).max(15),
  customer: z.object({
    name: str(80).min(2, "Please enter your full name"),
    email: z.string().trim().max(120).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"),
    phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number"),
  }),
  members: z.array(memberSchema).min(1, "Add at least one name for the sankalp").max(25),
  wish: str(2000),
  address: addressSchema.nullable(),
  requestId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,64}$/, "Invalid request id"),
});
export type WebBookingInput = z.infer<typeof webBookingSchema>;

const reason = str(500).min(5, "Give a reason (at least 5 characters)");
const requestId = z.string().trim().regex(/^[A-Za-z0-9_-]{8,64}$/, "Invalid request id");

/** Every admin action on a booking goes through this one union. */
export const bookingActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_paid"), reference: str(120).min(3, "Add the payment reference") }),
  z.object({ action: z.literal("assign"), panditId: z.string().trim().min(1), force: z.boolean().optional() }),
  z.object({ action: z.literal("unassign"), reason }),
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("proof"), videoUrl: url, liveUrl: url, photos: z.array(url).max(20), note: str(500) }),
  z.object({ action: z.literal("perform") }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("reopen"), reason }),
  z.object({ action: z.literal("reschedule"), date, time: z.string().refine((v) => v === "any" || isTime(v), "Invalid time"), reason, allowOverbook: z.boolean().optional(), ignoreCutoff: z.boolean().optional() }),
  z.object({ action: z.literal("sankalp"), members: z.array(memberSchema).min(1).max(25), wish: str(2000) }),
  z.object({ action: z.literal("address"), address: addressSchema }),
  z.object({ action: z.literal("prasad"), status: z.enum(PRASAD_STATUSES), courier: str(60), trackingNo: str(60), trackingUrl: url, note: str(300) }),
  z.object({ action: z.literal("cancel"), reason, refundAmount: money, refundMethod: z.enum(["razorpay", "manual"]), reference: str(120), requestId }),
  z.object({ action: z.literal("refund"), amount: money.min(1, "Enter an amount"), reason, method: z.enum(["razorpay", "manual"]), reference: str(120), requestId }),
  z.object({ action: z.literal("note"), text: str(1000).min(2) }),
  z.object({ action: z.literal("notes"), adminNotes: str(4000) }),
  // Havan anushthan: one update per day (re-posting a day replaces it).
  z.object({ action: z.literal("progress"), day: z.number().int().min(1).max(41), note: str(500).min(2, "Write a short update"), jaapDone: z.number().int().min(0).max(100_000_000).nullable(), photos: z.array(url).max(10), videoUrl: url }),
]);
export type BookingAction = z.infer<typeof bookingActionSchema>;

export const bookingListQuery = z.object({
  status: z.array(z.enum(BOOKING_STATUSES)).optional(),
  poojaId: z.string().max(40).optional(),
  panditId: z.string().max(40).optional(),
  from: date.optional(), to: date.optional(), q: str(80).optional(),
});

/* ---------------- categories ---------------- */
const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const imageUrl = z.string().trim().max(500).refine((v) => v === "" || /^https:\/\//i.test(v) || v.startsWith("/"), "Use an https:// link");

/** Quick add from the pooja editor: just a name (and optionally an icon). */
export const categoryCreateSchema = z.object({
  name: str(60).min(2, "Category name is required"),
  slug: z.string().trim().toLowerCase().max(70).refine((v) => v === "" || slugRe.test(v), "Use lowercase letters, numbers and dashes").optional(),
  icon: z.enum(CATEGORY_ICONS).optional(),
  image: imageUrl.optional(),
  description: str(300).optional(),
  seo: z.object({ title: str(70), description: str(170) }).optional(),
  visible: z.boolean().optional(),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;

export const categoryUpdateSchema = z.object({
  name: str(60).min(2, "Category name is required"),
  slug: z.string().trim().toLowerCase().max(70).regex(slugRe, "Use lowercase letters, numbers and dashes"),
  icon: z.enum(CATEGORY_ICONS),
  image: imageUrl,
  description: str(300),
  seo: z.object({ title: str(70), description: str(170) }),
  visible: z.boolean(),
});
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

export const categoryReorderSchema = z.object({ keys: z.array(z.string().trim().min(1).max(60)).min(1).max(500) })
  .refine((v) => new Set(v.keys).size === v.keys.length, "A category is listed twice");

export const categoryMergeSchema = z.object({ into: z.string().trim().min(1).max(60) });
