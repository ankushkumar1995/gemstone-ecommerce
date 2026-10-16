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
});

const parsed = schema.safeParse({
  DATA_SOURCE: process.env.DATA_SOURCE,
  MONGODB_URI: process.env.MONGODB_URI,
  NODE_ENV: process.env.NODE_ENV,
  // Accept the project's env var names (and the AWS-standard ones as fallback).
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_SECRET,
  AWS_REGION: process.env.AWS_REGION ?? process.env.REGION,
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET ?? process.env.BUCKET_NAME,
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
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
 * Per-module data source resolver.
 *
 * This is the key to one-at-a-time migration. Each repository calls
 * `dataSourceFor("services")`, which checks for a module-specific override env
 * var (e.g. DATA_SOURCE_SERVICES) and falls back to the global DATA_SOURCE
 * (which stays "mock"). So a module only switches to Mongo once we explicitly
 * set its flag — every other module keeps running on mock, untouched.
 *
 * Example .env:
 *   DATA_SOURCE=mock            # global default, keep as mock
 *   DATA_SOURCE_SERVICES=mongo  # only services uses the real database
 */
export function dataSourceFor(moduleName: string): DataSource {
  const key = `DATA_SOURCE_${moduleName.toUpperCase()}`;
  const raw = process.env[key];
  if (raw === "mongo" || raw === "mock") return raw;
  return env.DATA_SOURCE;
}
