import "server-only";

/**
 * Password utilities — the single place passwords are hashed, verified and
 * generated. Uses bcrypt (bcryptjs — pure JS, no native build). Plain
 * passwords are never stored or logged; only the bcrypt hash is persisted
 * (on the user's `passwordHash` field, which is `select:false`).
 */

import bcrypt from "bcryptjs";

const ROUNDS = 12; // cost factor — strong, ~250ms per hash

/** Hash a plain password for storage. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

/** Verify a plain password against a stored hash. */
export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Minimum strength: ≥8 chars, at least one letter and one number. Returns an
 * error message or null if acceptable. Kept deliberately simple but real.
 */
export function passwordIssue(plain: string): string | null {
  if (plain.length < 8) return "Password must be at least 8 characters";
  if (plain.length > 72) return "Password is too long (max 72 characters)"; // bcrypt limit
  if (!/[a-zA-Z]/.test(plain)) return "Password must contain a letter";
  if (!/[0-9]/.test(plain)) return "Password must contain a number";
  return null;
}

/** Generate a strong random temporary password (letters+digits+symbol). */
export function generatePassword(length = 14): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*?";
  const all = upper + lower + digits + symbols;
  // Guarantee at least one of each class, then fill the rest.
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  const base = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  for (let i = base.length; i < length; i++) base.push(pick(all));
  // Shuffle so the guaranteed chars aren't always in front.
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join("");
}
