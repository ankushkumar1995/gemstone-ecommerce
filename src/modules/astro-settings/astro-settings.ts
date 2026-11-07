import "server-only";

/**
 * Astrologer program settings — one document that every consultation-related
 * module reads instead of hardcoding business rules (commission, timeouts,
 * payout rules, tax toggles, recharge packs).
 *
 * Storage: mock (in-memory) or Mongo (`astro_settings`, single doc) via
 * DATA_SOURCE_ASTRO_SETTINGS. Values are validated on write; missing keys in
 * an older stored document fall back to DEFAULTS, so adding a new setting
 * never breaks existing data.
 *
 * GST/TDS are OFF by default: their exact applicability must be confirmed
 * with a chartered accountant before enabling.
 */

import { Schema, model, models, type Model } from "mongoose";
import { dataSourceFor } from "@/core/config/env";
import { ok, fail, type Result } from "@/core/result";
import { parse, z } from "@/core/validation";
import { cache } from "@/core/cache";
import { AppErrors } from "@/core/errors";

const cacheGet = <T,>(k: string) => cache.get<T>(k);
const cacheSet = <T,>(k: string, v: T, ttl: number) => cache.set<T>(k, v, ttl);
const cacheDel = (k: string) => cache.del(k);

export interface RechargePackSetting { amount: number; bonus: number; tag?: "Popular" | "Best value" | "" }

export interface AstroProgramSettings {
  /** % of every consultation kept by the platform. */
  commissionPct: number;
  minRate: number;
  maxRate: number;
  defaultRates: { chat: number; call: number; video: number };
  requireKycForApproval: boolean;
  /** Approved astrologers' name/photo/bio edits go to admin review. */
  reviewProfileEdits: boolean;
  /** Balance needed (in minutes of the rate) to start a session. */
  minStartMinutes: number;
  /** Seconds an astrologer has to accept a request. */
  requestTimeoutSec: number;
  /** Seconds after accept for both sides to join before "missed". */
  joinTimeoutSec: number;
  /** Seconds without any heartbeat from either side before auto-end. */
  idleTimeoutSec: number;
  /** Seconds without an astrologer heartbeat before they are shown offline. */
  presenceStaleSec: number;
  /** Consecutive missed requests before an astrologer is set offline. */
  maxMissedBeforeOffline: number;
  /** Start billing only after the astrologer's first reply (chat). */
  billFromFirstReply: boolean;
  /** Free minutes on a customer's very first consultation (0 = off). */
  firstSessionFreeMinutes: number;
  /** Days earnings stay "pending" (dispute window) before payout. */
  holdDays: number;
  payoutMinAmount: number;
  payoutCycle: "weekly" | "biweekly" | "monthly";
  gst: { enabled: boolean; ratePct: number };
  tds: { enabled: boolean; ratePct: number };
  rechargePacks: RechargePackSetting[];
  /** Mask phone numbers / emails / UPI IDs / links in chat messages. */
  maskContactInfo: boolean;
  /** Reviews need admin approval before they count. */
  moderateReviews: boolean;
  updatedAt?: string;
}

export const DEFAULT_ASTRO_SETTINGS: AstroProgramSettings = {
  commissionPct: 40,
  minRate: 5,
  maxRate: 300,
  defaultRates: { chat: 15, call: 20, video: 25 },
  requireKycForApproval: true,
  reviewProfileEdits: true,
  minStartMinutes: 5,
  requestTimeoutSec: 60,
  joinTimeoutSec: 90,
  idleTimeoutSec: 120,
  presenceStaleSec: 60,
  maxMissedBeforeOffline: 3,
  billFromFirstReply: true,
  firstSessionFreeMinutes: 0,
  holdDays: 7,
  payoutMinAmount: 500,
  payoutCycle: "weekly",
  gst: { enabled: false, ratePct: 18 },
  tds: { enabled: false, ratePct: 10 },
  rechargePacks: [
    { amount: 100, bonus: 10, tag: "" },
    { amount: 200, bonus: 25, tag: "" },
    { amount: 500, bonus: 75, tag: "Popular" },
    { amount: 1000, bonus: 200, tag: "Best value" },
    { amount: 2000, bonus: 500, tag: "" },
  ],
  maskContactInfo: true,
  moderateReviews: true,
};

export const astroSettingsSchema = z.object({
  commissionPct: z.number().min(0).max(90),
  minRate: z.number().int().min(1).max(10000),
  maxRate: z.number().int().min(1).max(10000),
  defaultRates: z.object({ chat: z.number().int().min(0), call: z.number().int().min(0), video: z.number().int().min(0) }),
  requireKycForApproval: z.boolean(),
  reviewProfileEdits: z.boolean(),
  minStartMinutes: z.number().int().min(1).max(60),
  requestTimeoutSec: z.number().int().min(15).max(600),
  joinTimeoutSec: z.number().int().min(15).max(900),
  idleTimeoutSec: z.number().int().min(30).max(1800),
  presenceStaleSec: z.number().int().min(20).max(900),
  maxMissedBeforeOffline: z.number().int().min(1).max(50),
  billFromFirstReply: z.boolean(),
  firstSessionFreeMinutes: z.number().int().min(0).max(30),
  holdDays: z.number().int().min(0).max(60),
  payoutMinAmount: z.number().int().min(0).max(1000000),
  payoutCycle: z.enum(["weekly", "biweekly", "monthly"]),
  gst: z.object({ enabled: z.boolean(), ratePct: z.number().min(0).max(40) }),
  tds: z.object({ enabled: z.boolean(), ratePct: z.number().min(0).max(40) }),
  rechargePacks: z.array(z.object({ amount: z.number().int().min(10).max(100000), bonus: z.number().int().min(0).max(100000), tag: z.enum(["Popular", "Best value", ""]).optional() })).min(1).max(12),
  maskContactInfo: z.boolean(),
  moderateReviews: z.boolean(),
}).partial().refine((v) => v.minRate === undefined || v.maxRate === undefined || v.minRate <= v.maxRate, { message: "minRate must be ≤ maxRate" });

export type UpdateAstroSettingsDto = z.infer<typeof astroSettingsSchema>;

/* ---------------- storage ---------------- */

const SettingsSchema = new Schema({ key: { type: String, unique: true, default: "main" }, data: { type: Schema.Types.Mixed, default: {} } }, { collection: "astro_settings", timestamps: true, versionKey: false });
const SettingsModel: Model<{ key: string; data: Partial<AstroProgramSettings>; updatedAt?: Date }> =
  (models.AstroSettings as Model<{ key: string; data: Partial<AstroProgramSettings>; updatedAt?: Date }>) ?? model("AstroSettings", SettingsSchema);

declare global {
  var __astroSettings: Partial<AstroProgramSettings> | undefined;
}

const merge = (stored: Partial<AstroProgramSettings> | undefined): AstroProgramSettings => ({
  ...DEFAULT_ASTRO_SETTINGS,
  ...(stored ?? {}),
  defaultRates: { ...DEFAULT_ASTRO_SETTINGS.defaultRates, ...(stored?.defaultRates ?? {}) },
  gst: { ...DEFAULT_ASTRO_SETTINGS.gst, ...(stored?.gst ?? {}) },
  tds: { ...DEFAULT_ASTRO_SETTINGS.tds, ...(stored?.tds ?? {}) },
});

const CACHE_KEY = "astro-settings";

export const astroSettingsService = {
  /** Current settings (cached for 30s). Never fails: falls back to defaults. */
  async get(): Promise<AstroProgramSettings> {
    const cached = cacheGet<AstroProgramSettings>(CACHE_KEY);
    if (cached) return cached;
    let stored: Partial<AstroProgramSettings> | undefined;
    if (dataSourceFor("astro_settings") === "mongo") {
      try {
        const { connectMongoose } = await import("@/core/db/mongoose");
        await connectMongoose();
        const doc = await SettingsModel.findOne({ key: "main" }).lean();
        stored = doc ? { ...(doc.data ?? {}), updatedAt: doc.updatedAt?.toISOString() } : undefined;
      } catch {
        stored = undefined;
      }
    } else {
      stored = global.__astroSettings;
    }
    const value = merge(stored);
    cacheSet(CACHE_KEY, value, 30);
    return value;
  },

  async update(input: unknown): Promise<Result<AstroProgramSettings>> {
    const parsed = parse(astroSettingsSchema, input);
    if (!parsed.ok) return fail(parsed.error);
    const current = await this.get();
    const next = merge({ ...current, ...parsed.value, updatedAt: new Date().toISOString() });
    if (next.minRate > next.maxRate) return fail(AppErrors.validation("minRate must be ≤ maxRate"));
    const { updatedAt: _u, ...data } = next;
    void _u;
    if (dataSourceFor("astro_settings") === "mongo") {
      const { connectMongoose } = await import("@/core/db/mongoose");
      await connectMongoose();
      await SettingsModel.updateOne({ key: "main" }, { $set: { data } }, { upsert: true });
    } else {
      global.__astroSettings = data;
    }
    cacheDel(CACHE_KEY);
    return ok(next);
  },
};
