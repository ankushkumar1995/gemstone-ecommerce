/**
 * /api/v1/health
 *   GET → lightweight health check for the server + database.
 *
 * Reports the global data source, which modules are on Mongo (per-module
 * migration), and — if any module uses Mongo — whether the DB is reachable
 * plus a sample collection count and ping. Used by the /admin/health page.
 */

import { NextResponse } from "next/server";
import { env, dataSourceFor } from "@/core/config/env";

export const dynamic = "force-dynamic";

/** Modules that have a Mongo implementation available to switch on. */
const KNOWN_MODULES = [
  "services",
  "settings",
  "products",
  "categories",
  "blog",
  "orders",
  "customers",
  "coupons",
  "banners",
  "bookings",
  "popups",
  "email",
  "users",
  "astrologers",
  "astro_settings",
  "wallets",
  "poojas",
] as const;

/** Modules that only have an in-memory repository so far (always mock). */
const MOCK_ONLY_MODULES = ["collections", "pages", "leads", "reviews", "returns", "audit"] as const;

interface HealthReport {
  status: "ok" | "degraded";
  server: { up: true; time: string; uptimeSec: number; nodeEnv: string };
  globalDataSource: "mock" | "mongo";
  modulesOnMongo: string[];
  modulesOnMock: string[];
  database: {
    configured: boolean;
    used: boolean;
    connected: boolean;
    name: string | null;
    servicesCount: number | null;
    pingMs: number | null;
    error: string | null;
  };
}

export async function GET() {
  const modulesOnMongo = KNOWN_MODULES.filter((m) => dataSourceFor(m) === "mongo");
  const modulesOnMock = [...KNOWN_MODULES.filter((m) => dataSourceFor(m) !== "mongo"), ...MOCK_ONLY_MODULES];
  const dbUsed = modulesOnMongo.length > 0;

  const report: HealthReport = {
    status: "ok",
    server: {
      up: true,
      time: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      nodeEnv: env.NODE_ENV,
    },
    globalDataSource: env.DATA_SOURCE,
    modulesOnMongo: [...modulesOnMongo],
    modulesOnMock: [...modulesOnMock],
    database: {
      configured: Boolean(env.MONGODB_URI),
      used: dbUsed,
      connected: false,
      name: null,
      servicesCount: null,
      pingMs: null,
      error: null,
    },
  };

  // Only probe the DB when at least one module actually uses Mongo.
  if (dbUsed) {
    const started = Date.now();
    try {
      const { connectMongoose } = await import("@/core/db/mongoose");
      const conn = await connectMongoose();
      const db = conn.connection.db;
      await db!.admin().ping();
      report.database.connected = true;
      report.database.name = conn.connection.name;
      report.database.servicesCount = await db!.collection("services").countDocuments();
      report.database.pingMs = Date.now() - started;
    } catch (e) {
      report.status = "degraded";
      report.database.connected = false;
      report.database.pingMs = Date.now() - started;
      report.database.error = e instanceof Error ? e.message : String(e);
    }
  }

  const httpStatus = report.status === "ok" ? 200 : 503;
  return NextResponse.json(report, { status: httpStatus });
}
