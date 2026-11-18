/** Validation for /api/v1/account/astro-profile (zod). */
import { z } from "zod";

const isRealDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

export const astroProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(120),
  dob: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be yyyy-mm-dd")
    .refine(isRealDate, "Enter a real date of birth")
    .refine((s) => s >= "1900-01-01" && s <= new Date().toISOString().slice(0, 10), "Date of birth must be between 1900 and today"),
  birthTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Birth time must be HH:mm"),
  timeAccuracy: z.enum(["exact", "approximate", "unknown"]),
  gender: z.enum(["male", "female", "other"]),
  birthPlace: z.string().trim().min(1, "Pick your birth city").max(200),
  language: z.enum(["English", "Hindi", "Hinglish"]).default("English"),
  interests: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

export type AstroProfileDto = z.infer<typeof astroProfileSchema>;
