/**
 * Typed, validated environment configuration.
 *
 * All env access goes through here so misconfiguration is caught early and
 * the rest of the code gets fully-typed, safe values. Add new vars to the
 * schema; never read `process.env` directly elsewhere.
 */

import { z } from "zod";

const schema = z.object({
  // Which data source the repositories use. Defaults to "mock" so the app
  // runs with zero setup. Switch to "mongo" in Phase 2 (needs MONGODB_URI).
  DATA_SOURCE: z.enum(["mock", "mongo"]).default("mock"),
  MONGODB_URI: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = schema.safeParse({
  DATA_SOURCE: process.env.DATA_SOURCE,
  MONGODB_URI: process.env.MONGODB_URI,
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsed.success) {
  // Fail fast and loud on bad config.
  console.error("❌ Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
export type Env = typeof env;
