import "server-only";

/**
 * Mongoose connection helper — the ONE place the app connects to MongoDB.
 *
 * Every DB operation in the app goes through Mongoose models, and those models
 * rely on this single cached connection. Next.js hot-reloads modules in dev,
 * which would otherwise open a new connection on every change and exhaust the
 * cluster — so we cache the connection on `globalThis`.
 *
 * On connect it logs (once) which database + host it connected to, with the
 * password redacted.
 */

import mongoose from "mongoose";
import { env } from "@/core/config/env";

const DEFAULT_DB_NAME = "astro_unkle_dev";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  logged: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongoose: MongooseCache | undefined;
}

const cache: MongooseCache = global.__mongoose ?? { conn: null, promise: null, logged: false };
global.__mongoose = cache;

/** Hide the password in a mongodb(+srv) URI before logging it. */
function redact(uri: string): string {
  return uri.replace(/\/\/([^:@/]+):([^@]+)@/, "//$1:****@");
}

/** Extract the db name from a mongodb(+srv) URI, if present. */
function dbNameFromUri(uri: string): string | undefined {
  try {
    const afterHost = uri.split("/").slice(3).join("/");
    const name = afterHost.split("?")[0];
    return name && name.length > 0 ? name : undefined;
  } catch {
    return undefined;
  }
}

/** Connect (or reuse the cached connection) and return the mongoose instance. */
export async function connectMongoose(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Add it to .env to use the database.");
  }

  const uri = env.MONGODB_URI;
  const dbName = dbNameFromUri(uri) ?? DEFAULT_DB_NAME;

  if (!cache.promise) {
    // One-time connection event logging.
    const conn = mongoose.connection;
    conn.on("connected", () => {
      if (cache.logged) return;
      cache.logged = true;
      const host = conn.host ?? "unknown-host";
      console.log("✅ [MongoDB] Connected via Mongoose");
      console.log(`   • database : ${conn.name ?? dbName}`);
      console.log(`   • host     : ${host}`);
      console.log(`   • uri      : ${redact(uri)}`);
    });
    conn.on("error", (err) => {
      console.error("❌ [MongoDB] Connection error:", err?.message ?? err);
    });
    conn.on("disconnected", () => {
      console.warn("⚠️  [MongoDB] Disconnected");
    });

    cache.promise = mongoose.connect(uri, {
      dbName,
      serverSelectionTimeoutMS: 10_000,
      autoIndex: true,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

export { mongoose };
