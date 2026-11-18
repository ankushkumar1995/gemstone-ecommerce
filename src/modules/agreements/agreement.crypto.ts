import "server-only";

/**
 * Hashing for partner agreements.
 *
 *  • contentHash — SHA-256 of a canonical JSON of the text. Built field by
 *    field (fixed order) so the same text always gives the same hash.
 *  • fingerprint — ties one signature to the text, the signer and the OTP.
 *  • OTP codes   — stored only as an HMAC with a server secret, compared in
 *    constant time.
 */

import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "@/core/config/env";
import type { AgreementClause, AgreementKeyPoint } from "./agreement.types";

const DEV_PEPPER = "astrounkle-dev-only-agreement-otp-pepper-change-me";
const pepper = () => (env.ADMIN_SESSION_SECRET || DEV_PEPPER) + "::agreement-otp";

export const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export function contentHashOf(v: {
  version: string;
  title: string;
  clauses: AgreementClause[];
  keyPoints: AgreementKeyPoint[];
}): string {
  const canonical = JSON.stringify({
    version: v.version,
    title: v.title,
    clauses: v.clauses.map((c) => ({ heading: c.heading, body: c.body })),
    keyPoints: v.keyPoints.map((k) => k.text),
  });
  return sha256(canonical);
}

export function fingerprintOf(p: {
  contentHash: string;
  astrologerId: string;
  typedName: string;
  signedAt: string;
  challengeId: string;
  prevFingerprint: string | null;
}): string {
  return sha256([p.contentHash, p.astrologerId, p.typedName, p.signedAt, p.challengeId, p.prevFingerprint ?? ""].join("|"));
}

/** 6-digit code, uniformly random (crypto RNG). */
export const newOtpCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/**
 * Bound to one challenge (partner + version + creation time), so a code can't
 * be replayed on another challenge even if two codes happen to match.
 */
export const otpBinding = (astrologerId: string, agreementId: string, createdAt: string) => `${astrologerId}|${agreementId}|${createdAt}`;

export const hashOtp = (binding: string, code: string) =>
  createHmac("sha256", pepper()).update(`${binding}:${code}`).digest("hex");

export function otpMatches(binding: string, code: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(binding, code), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
