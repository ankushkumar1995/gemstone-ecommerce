/**
 * Typed, validated environment configuration.
 *
 * All env access goes through here so misconfiguration is caught early and
 * the rest of the code gets fully-typed, safe values. Add new vars to the
 * schema; never read `process.env` directly elsewhere.
 */

import { z } from "zod";

export type DataSource = "mock" | "mongo";

const schema = z.object({
  // GLOBAL default data source. Stays "mock" so the whole app runs with zero
  // setup and never crashes. We migrate ONE module at a time: a module only
  // goes to Mongo when its own override is set (see dataSourceFor below).
  DATA_SOURCE: z.enum(["mock", "mongo"]).default("mock"),
  MONGODB_URI: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // AWS S3 (admin media storage). Names mirror what's in .env; optional so the
  // app still boots without S3 configured (uploads just report "not configured").
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),

  // Secret used to sign admin session JWTs. Optional in dev (a default is used
  // with a warning); REQUIRED and must be strong (>=32 chars) in production.
  ADMIN_SESSION_SECRET: z.string().optional(),
  // Default admin email (fallback owner / seed).
  ADMIN_EMAIL: z.string().optional(),

  // Razorpay payment gateway. KEY_ID is also exposed to the browser (it's the
  // publishable id); KEY_SECRET + WEBHOOK_SECRET are server-only. All optional
  // so the app boots without them — online payments just stay unavailable and
  // checkout falls back to COD.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // SMTP — the password/secret lives ONLY in env (never in settings/DB). Host/
  // port/user/from come from store settings; this completes the credentials.
  // When absent, the mailer logs emails instead of sending (dev-safe).
  SMTP_PASSWORD: z.string().optional(),

  // Resend API key (email provider). Lives ONLY in env. When absent, the
  // Resend provider is skipped and the engine falls back to the next provider.
  RESEND_API_KEY: z.string().optional(),
});

const parsed = schema.safeParse({
  DATA_SOURCE: process.env.DATA_SOURCE,
  MONGODB_URI: process.env.MONGODB_URI,
  NODE_ENV: process.env.NODE_ENV,
  // Accept several env var names. We prefer NON-"AWS_"-prefixed names first,
  // because Vercel (and some AWS tooling) reserve/validate "AWS_"-prefixed
  // vars and may strip or warn on them ("Missing AWS Region"). The S3_* names
  // are the safe, recommended ones to set in production.
  AWS_ACCESS_KEY_ID:
    process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY:
    process.env.S3_SECRET_ACCESS_KEY ??
    process.env.AWS_SECRET_ACCESS_KEY ??
    process.env.AWS_ACCESS_KEY_SECRET,
  AWS_REGION:
    process.env.S3_REGION ?? process.env.REGION ?? process.env.AWS_REGION,
  AWS_S3_BUCKET:
    process.env.S3_BUCKET ?? process.env.BUCKET_NAME ?? process.env.AWS_S3_BUCKET,
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
});

if (!parsed.success) {
  // Fail fast and loud on bad config.
  console.error("❌ Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
export type Env = typeof env;

// Hard-fail in production if the session secret is missing or weak — a weak
// JWT secret means forgeable admin sessions.
if (env.NODE_ENV === "production" && (!env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.length < 32)) {
  throw new Error("ADMIN_SESSION_SECRET must be set and at least 32 characters in production");
}

/**
 * Per-module data source resolver, used by every repository that has a Mongo
 * implementation.
 *
 * Resolution order:
 *  1. An explicit per-module override, if set (DATA_SOURCE_<MODULE>=mock|mongo).
 *     Optional; only useful to force one module onto mock for a test/debug.
 *  2. MONGODB_URI is set → "mongo". No per-module flag is needed: a new module
 *     with a Mongo repository works on the real database out of the box.
 *  3. Otherwise the global DATA_SOURCE (default "mock"), so the app still runs
 *     with zero setup when no database is configured.
 *
 * Modules that only have a mock repository read `env.DATA_SOURCE` directly and
 * are unaffected by this.
 */
export function dataSourceFor(moduleName: string): DataSource {
  const key = `DATA_SOURCE_${moduleName.toUpperCase()}`;
  const raw = process.env[key];
  if (raw === "mongo" || raw === "mock") return raw;
  if (env.MONGODB_URI && env.MONGODB_URI.trim() !== "") return "mongo";
  return env.DATA_SOURCE;
}
