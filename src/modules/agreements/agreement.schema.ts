/** Partner agreements — request validation (zod). */

import { z } from "zod";

const isoDate = z
  .string()
  .trim()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "Enter a valid date" });

const text = (max: number) => z.string().trim().max(max);

export const clauseSchema = z.object({
  id: z.string().trim().max(40).optional(),
  heading: text(160).min(2, "Clause heading is too short"),
  body: text(8000).min(10, "Clause text is too short"),
});

export const keyPointSchema = z.object({
  id: z.string().trim().max(40).optional(),
  text: text(240).min(5, "Key point is too short"),
});

/** Version numbers like 3, 3.2 or 3.2.1. */
export const VERSION_RE = /^\d{1,3}(\.\d{1,3}){0,2}$/;

/** Create / update a draft. Every field optional on update. */
export const draftSchema = z.object({
  version: z.string().trim().regex(VERSION_RE, "Use a version like 3.3"),
  title: text(140).min(3, "Title is too short"),
  changes: z.array(text(240).min(3)).max(20).default([]),
  clauses: z.array(clauseSchema).max(60).default([]),
  keyPoints: z.array(keyPointSchema).max(10).default([]),
  effectiveFrom: isoDate,
  signDeadline: isoDate,
});
export type DraftDto = z.infer<typeof draftSchema>;

export const draftUpdateSchema = draftSchema.partial();
export type DraftUpdateDto = z.infer<typeof draftUpdateSchema>;

export const createDraftSchema = z.union([
  z.object({ cloneFrom: z.string().trim().min(1).max(60), version: z.string().trim().regex(VERSION_RE, "Use a version like 3.3").optional() }),
  draftSchema,
]);

/** Publishing asks the admin to type the version again, as a deliberate act. */
export const publishSchema = z.object({ confirmVersion: z.string().trim().min(1).max(20) });

export const otpRequestSchema = z.object({
  agreementId: z.string().trim().min(1).max(60),
  contentHash: z.string().trim().regex(/^[a-f0-9]{64}$/, "Reload the page and try again"),
  typedName: text(120).min(2, "Type your full legal name"),
  keyPoints: z.array(z.string().trim().max(40)).max(20),
  scrolledToEnd: z.literal(true, { message: "Read the agreement to the end first" }),
});
export type OtpRequestDto = z.infer<typeof otpRequestSchema>;

export const signSchema = otpRequestSchema.extend({
  challengeId: z.string().trim().min(1).max(60),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit OTP"),
  secondsOnPage: z.number().int().min(0).max(24 * 3600).default(0),
});
export type SignDto = z.infer<typeof signSchema>;

export const voidSchema = z.object({ reason: text(500).min(10, "Give a clear reason (at least 10 characters)") });

export const extensionSchema = z.object({
  astrologerId: z.string().trim().min(1).max(60),
  until: isoDate,
  reason: text(300).min(5, "Give a reason (at least 5 characters)"),
});

export const remindSchema = z.object({ astrologerIds: z.array(z.string().trim().min(1).max(60)).max(1000).optional() });
