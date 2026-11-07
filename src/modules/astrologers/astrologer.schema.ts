/**
 * Astrologers domain — Zod schemas (every write is validated here first).
 */

import { z } from "zod";
import { ASTRO_BADGES, ASTROLOGER_STATUSES, KYC_DOC_TYPES } from "./astrologer.types";

/* ---------------- shared validators ---------------- */

export const PHONE_RE = /^(\+91[-\s]?)?[6-9]\d{9}$/;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Verhoeff checksum — catches typos in 12-digit Aadhaar numbers. */
const VD = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const VP = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
export function validAadhaar(raw: string): boolean {
  const n = raw.replace(/\s/g, "");
  if (!/^[2-9]\d{11}$/.test(n)) return false;
  let c = 0;
  n.split("").reverse().forEach((d, i) => { c = VD[c][VP[i % 8][Number(d)]]; });
  return c === 0;
}

const name = z.string().trim().min(2, "Too short").max(80);
const list = (max: number) => z.array(z.string().trim().min(1).max(40)).max(max);
const rate = z.number().int("Whole rupees only").min(0).max(10000);
const slot = z.object({
  day: z.number().int().min(0).max(6),
  start: z.string().regex(TIME_RE, "Use HH:mm"),
  end: z.string().regex(TIME_RE, "Use HH:mm"),
}).refine((s) => s.start < s.end, { message: "End time must be after start time" });

const profileFields = {
  displayName: name,
  legalName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(PHONE_RE, "Enter a valid Indian mobile number"),
  gender: z.enum(["male", "female", "other"]).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  photo: z.string().trim().url().max(600).optional().or(z.literal("")),
  shortBio: z.string().trim().min(20, "Write at least 20 characters").max(160),
  bio: z.string().trim().max(3000).optional(),
  languages: list(10).min(1, "Pick at least one language"),
  expertise: list(10).min(1, "Pick at least one skill"),
  categories: list(12).default([]),
  experienceYears: z.number().int().min(0).max(80),
  education: z.string().trim().max(300).optional(),
  certifications: z.string().trim().max(600).optional(),
};

/* ---------------- public apply ---------------- */

export const applySchema = z.object({
  ...profileFields,
  email: z.string().trim().toLowerCase().email().max(180),
  password: z.string().min(8).max(72),
  rates: z.object({ chat: rate, call: rate, video: rate }).partial().optional(),
  acceptTerms: z.literal(true, { message: "Please accept the partner terms" }),
});
export type ApplyDto = z.infer<typeof applySchema>;

/* ---------------- admin invite ---------------- */

export const inviteSchema = z.object({
  displayName: name,
  legalName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(180),
  phone: z.string().trim().regex(PHONE_RE, "Enter a valid Indian mobile number"),
  languages: list(10).default([]),
  expertise: list(10).default([]),
  experienceYears: z.number().int().min(0).max(80).default(0),
  /** Approve immediately (skips review; KYC rules still apply to going live). */
  approveNow: z.boolean().default(false),
});
export type InviteDto = z.infer<typeof inviteSchema>;

/* ---------------- self update ---------------- */

export const selfUpdateSchema = z.object({
  ...profileFields,
  rates: z.object({ chat: rate, call: rate, video: rate }),
  availability: z.array(slot).max(42),
  timezone: z.string().trim().min(3).max(60),
}).partial();
export type SelfUpdateDto = z.infer<typeof selfUpdateSchema>;

/* ---------------- admin update ---------------- */

export const adminUpdateSchema = z.object({
  ...profileFields,
  email: z.string().trim().toLowerCase().email().max(180),
  rates: z.object({ chat: rate, call: rate, video: rate }),
  availability: z.array(slot).max(42),
  commissionPct: z.number().min(0).max(90).nullable(),
  maxRate: z.number().int().min(1).max(10000).nullable(),
  featured: z.boolean(),
  sortWeight: z.number().int().min(-1000).max(1000),
  badges: z.array(z.enum(ASTRO_BADGES as [string, ...string[]])).max(5),
  hidden: z.boolean(),
  adminNotes: z.string().trim().max(4000),
  payoutVerified: z.boolean(),
}).partial();
export type AdminUpdateDto = z.infer<typeof adminUpdateSchema>;

/* ---------------- status ---------------- */

export const statusSchema = z.object({
  status: z.enum(ASTROLOGER_STATUSES as [string, ...string[]]),
  reason: z.string().trim().max(500).optional(),
}).refine((v) => !["rejected", "suspended"].includes(v.status) || (v.reason && v.reason.length >= 5), {
  message: "Give a reason (at least 5 characters)",
  path: ["reason"],
});

/* ---------------- KYC ---------------- */

export const kycSubmitSchema = z.object({
  type: z.enum(KYC_DOC_TYPES as [string, ...string[]]),
  number: z.string().trim().max(40).optional(),
  fileKey: z.string().trim().max(400).optional(),
  fileName: z.string().trim().max(160).optional(),
}).superRefine((v, ctx) => {
  if (v.type === "pan") {
    if (!v.number || !PAN_RE.test(v.number.toUpperCase())) ctx.addIssue({ code: "custom", path: ["number"], message: "Enter a valid PAN (e.g. ABCDE1234F)" });
  }
  if (v.type === "aadhaar") {
    if (!v.number || !validAadhaar(v.number)) ctx.addIssue({ code: "custom", path: ["number"], message: "Enter a valid 12-digit Aadhaar number" });
  }
  if (v.fileKey && (!v.fileKey.startsWith("kyc/") || v.fileKey.includes(".."))) ctx.addIssue({ code: "custom", path: ["fileKey"], message: "Invalid file" });
});
export type KycSubmitDto = z.infer<typeof kycSubmitSchema>;

export const kycReviewSchema = z.object({
  type: z.enum(KYC_DOC_TYPES as [string, ...string[]]),
  status: z.enum(["verified", "rejected"]),
  note: z.string().trim().max(500).optional(),
}).refine((v) => v.status !== "rejected" || (v.note && v.note.length >= 3), { message: "Say why it was rejected", path: ["note"] });

/* ---------------- payout account ---------------- */

export const payoutAccountSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("bank"),
    accountHolder: z.string().trim().min(2).max(120),
    accountNumber: z.string().trim().regex(/^\d{9,18}$/, "Account number must be 9-18 digits"),
    ifsc: z.string().trim().toUpperCase().regex(IFSC_RE, "Enter a valid IFSC (e.g. HDFC0001234)"),
    bankName: z.string().trim().min(2).max(120),
  }),
  z.object({
    method: z.literal("upi"),
    accountHolder: z.string().trim().min(2).max(120),
    upiId: z.string().trim().toLowerCase().regex(UPI_RE, "Enter a valid UPI ID (e.g. name@okhdfc)"),
  }),
]);
export type PayoutAccountDto = z.infer<typeof payoutAccountSchema>;

/* ---------------- presence ---------------- */

export const presenceSchema = z.object({
  action: z.enum(["online", "offline", "heartbeat"]),
  channels: z.object({ chat: z.boolean(), call: z.boolean(), video: z.boolean() }).partial().optional(),
});
export type PresenceDto = z.infer<typeof presenceSchema>;

export const pendingReviewSchema = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

export const noteSchema = z.object({ note: z.string().trim().min(1).max(500) });
