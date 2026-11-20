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
  /** First-chat offer rules (minutes above; 0 minutes = offer off). */
  firstChat: FirstChatSettings;
  /** Days earnings stay "pending" (dispute window) before payout. */
  holdDays: number;
  payoutMinAmount: number;
  payoutCycle: "weekly" | "biweekly" | "monthly";
  gst: { enabled: boolean; ratePct: number };
  /** TDS deducted from payouts. `noPanRatePct` applies when the astrologer has no PAN on file. */
  tds: { enabled: boolean; ratePct: number; noPanRatePct: number };
  rechargePacks: RechargePackSetting[];
  /** Mask phone numbers / emails / UPI IDs / links in chat messages. */
  maskContactInfo: boolean;
  /** Reviews need admin approval before they count. */
  moderateReviews: boolean;
  /** Live sessions (astrologer goes live for everyone). */
  live: LiveSettings;
  /** How payouts are created and sent. */
  payouts: PayoutSettings;
  /** Tips customers can add after a chat. */
  tips: TipSettings;
  /** Waitlist when an astrologer is busy. */
  waitlist: WaitlistSettings;
  /** Refer a friend: wallet bonus for both, only after the friend's first qualifying recharge. */
  referral: ReferralSettings;
  /** Remedy suggestions in chat: the astrologer earns a commission when the customer buys what they suggested. */
  remedy: RemedySettings;
  /** Push notifications to the customer app. */
  push: PushSettings;
  updatedAt?: string;
}
export type PushGroup = "live" | "reminders" | "chat" | "wallet" | "orders";
export interface PushSettings {
  /** Master switch: off = nothing is sent (the in-app inbox still fills). */
  enabled: boolean;
  /** Turn a whole kind of notification off for everyone. */
  groups: Record<PushGroup, boolean>;
  /** Default quiet hours for new customers (IST, "HH:MM"). Chat and "your turn" alerts still come through. */
  quietStart: string;
  quietEnd: string;
  /** Most "X is live" alerts one customer gets in a day (0 = no limit). */
  liveDailyCap: number;
  /** Most followers alerted when one astrologer goes live. */
  liveFanoutMax: number;
  /** One "new message" alert per chat in this many seconds (the newest replaces the older one). */
  chatCooldownSec: number;
}
export interface RemedySettings {
  enabled: boolean;
  /** % of the item's paid price (after discount, before shipping / tax) paid to the astrologer. Fixed on each suggestion when it is sent. */
  commissionPct: number;
  /** A purchase counts if it is made this many days after the suggestion. */
  attributionDays: number;
  /** Commission is confirmed this many days after delivery (shop) or after the pooja is done (return / complaint window). */
  confirmAfterDays: number;
  allowProducts: boolean;
  allowPoojas: boolean;
  /** Most suggestions in one chat. */
  maxPerChat: number;
  /** Most commission on one sale (₹, 0 = no limit). */
  maxCommission: number;
}
export interface PayoutSettings {
  /** "manual" = admin pays by bank transfer and enters the UTR. "razorpayx" = sent automatically. */
  provider: "manual" | "razorpayx";
  /** Create payout requests by itself on the cycle day for everyone above the minimum. */
  autoCreate: boolean;
  /** Day the weekly cycle runs (0 = Sunday … 6 = Saturday, IST). */
  cycleWeekday: number;
  /** Only pay to a payout account the admin marked verified. */
  requireVerifiedAccount: boolean;
  /** Most one astrologer can withdraw per request (₹, 0 = no limit). */
  maxPerRequest: number;
}
export interface TipSettings {
  enabled: boolean;
  /** Quick amounts shown after a chat (₹). */
  presets: number[];
  /** Most one customer can tip on one chat (₹). */
  maxPerChat: number;
  /** Hours after a chat during which a tip can be added. */
  windowHours: number;
}
export interface FirstChatSettings {
  /** The platform pays the astrologer this % of their normal earning for each free minute (so offer chats are not declined). */
  astrologerPayPct: number;
  /** Offer only with astrologers whose chat rate is at most this (₹/min). 0 = any rate. Caps the offer's cost. */
  maxRate: number;
}
export interface ReferralSettings {
  enabled: boolean;
  /** Bonus (₹, promo bucket) for the person who shared the code. */
  referrerReward: number;
  /** Bonus (₹, promo bucket) for the friend who joined with it. */
  refereeReward: number;
  /** The friend's recharge must be at least this much (₹, before GST) to count. */
  minRecharge: number;
  /** Most rewarded referrals per referrer in a calendar month (IST). Over the cap the friend still gets theirs. */
  monthlyCap: number;
  /** A code can be entered only this many days after the friend's account was made. */
  applyWithinDays: number;
  /** The friend has this many days after entering the code to make the qualifying recharge. */
  qualifyWithinDays: number;
}
export interface WaitlistSettings {
  enabled: boolean;
  /** Most people waiting for one astrologer. */
  maxSize: number;
  /** Seconds a customer has to take their turn. */
  offerSec: number;
}
export interface LiveGiftSetting { id: string; name: string; emoji: string; price: number }
export interface LiveSettings {
  enabled: boolean;
  /** A live ends by itself after this many minutes. */
  maxMinutes: number;
  /** Default seconds between two comments from one viewer. */
  slowSec: number;
  /** Most questions waiting in the "ask on live" queue. */
  maxQueue: number;
  /** Gifts viewers can send (₹, paid from the wallet; commission applies). */
  gifts: LiveGiftSetting[];
  /** Combo sizes a viewer can send at once (×1, ×5, ×10). */
  giftCombos: number[];
  /** A gift worth at least this much (₹, gift × combo) gets the full-screen animation. */
  bigGiftAt: number;
  /** Paid priority questions: the question jumps the line and is highlighted. */
  superChat: SuperChatSettings;
  /** Extra words the comment filter hides (on top of the built-in list). */
  blockedWords: string[];
  /** Hidden comments in one live before the viewer is muted on it (0 = never). */
  autoMuteStrikes: number;
  /** Default one-tap replies in the live console (an astrologer can save their own). {name} = the viewer being replied to. */
  quickReplies: string[];
  /** Default prompts the astrologer posts and pins to get viewers talking ("Comment your rashi"). */
  askTemplates: string[];
  /** Live video (LiveKit). The recorder for viewers is billed per minute, so these keep the cost down. */
  video: LiveVideoSettings;
}
export interface LiveVideoSettings {
  /** Off = lives run with the photo and chat only. */
  enabled: boolean;
  /** What viewers get. 540p is plenty for a phone and uses less than half the data. */
  quality: "540p" | "720p";
  /** Run the recorder only while someone is watching (no cost for empty lives). */
  waitForViewers: boolean;
  /** Stop the recorder after this many seconds with no viewer. */
  idleStopSec: number;
  /** Astrologers may go live with the mic only (about 4 times cheaper). */
  allowAudioOnly: boolean;
}
export const DEFAULT_LIVE_VIDEO: LiveVideoSettings = { enabled: true, quality: "540p", waitForViewers: true, idleStopSec: 120, allowAudioOnly: true };
export interface SuperChatSettings {
  enabled: boolean;
  /** Price (₹) and how long (seconds) the highlight stays pinned on screen. */
  tiers: { price: number; pinSec: number }[];
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
  tds: { enabled: false, ratePct: 10, noPanRatePct: 20 },
  rechargePacks: [
    { amount: 100, bonus: 10, tag: "" },
    { amount: 200, bonus: 25, tag: "" },
    { amount: 500, bonus: 75, tag: "Popular" },
    { amount: 1000, bonus: 200, tag: "Best value" },
    { amount: 2000, bonus: 500, tag: "" },
  ],
  maskContactInfo: true,
  moderateReviews: true,
  live: {
    enabled: true,
    maxMinutes: 180,
    slowSec: 3,
    maxQueue: 30,
    gifts: [
      { id: "rose", name: "Rose", emoji: "🌹", price: 11 },
      { id: "diya", name: "Diya", emoji: "🪔", price: 21 },
      { id: "lotus", name: "Lotus", emoji: "🪷", price: 51 },
      { id: "shankh", name: "Shankh", emoji: "🐚", price: 101 },
      { id: "crown", name: "Crown", emoji: "👑", price: 251 },
      { id: "mandir", name: "Mandir", emoji: "🛕", price: 501 },
    ],
    giftCombos: [1, 5, 10],
    bigGiftAt: 251,
    superChat: { enabled: true, tiers: [{ price: 51, pinSec: 60 }, { price: 101, pinSec: 120 }, { price: 251, pinSec: 300 }] },
    blockedWords: [],
    autoMuteStrikes: 3,
    quickReplies: ["Namaste {name}, welcome to the live.", "Please send your question with the Ask button. I answer one by one.", "Please share your date, time and place of birth.", "Thank you for the gift, {name}. Blessings to you.", "For a detailed reading, tap 1-to-1 chat. I will take you after this live.", "Please be patient, I will come to your question."],
    askTemplates: ["Comment your rashi (moon sign) and I will tell you this week's forecast.", "Which area do you want guidance on today: career, marriage, money or health?", "Write your date of birth (DD-MM-YYYY) in the comments.", "Who here is facing delays in marriage? Comment YES.", "Share one problem you want a remedy for today."],
    video: DEFAULT_LIVE_VIDEO,
  },
  payouts: { provider: "manual", autoCreate: false, cycleWeekday: 1, requireVerifiedAccount: true, maxPerRequest: 0 },
  tips: { enabled: true, presets: [21, 51, 101, 251], maxPerChat: 5000, windowHours: 24 },
  waitlist: { enabled: true, maxSize: 10, offerSec: 60 },
  firstChat: { astrologerPayPct: 50, maxRate: 0 },
  referral: { enabled: true, referrerReward: 100, refereeReward: 100, minRecharge: 200, monthlyCap: 10, applyWithinDays: 7, qualifyWithinDays: 30 },
  remedy: { enabled: true, commissionPct: 10, attributionDays: 7, confirmAfterDays: 7, allowProducts: true, allowPoojas: true, maxPerChat: 5, maxCommission: 0 },
  push: {
    enabled: true,
    groups: { live: true, reminders: true, chat: true, wallet: true, orders: true },
    quietStart: "22:00",
    quietEnd: "08:00",
    liveDailyCap: 5,
    liveFanoutMax: 5000,
    chatCooldownSec: 60,
  },
};

const DEFAULT_LIVE_TEXTS = { quickReplies: DEFAULT_ASTRO_SETTINGS.live.quickReplies, askTemplates: DEFAULT_ASTRO_SETTINGS.live.askTemplates };

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
  tds: z.object({ enabled: z.boolean(), ratePct: z.number().min(0).max(40), noPanRatePct: z.number().min(0).max(40).default(20) }),
  rechargePacks: z.array(z.object({ amount: z.number().int().min(10).max(100000), bonus: z.number().int().min(0).max(100000), tag: z.enum(["Popular", "Best value", ""]).optional() })).min(1).max(12),
  maskContactInfo: z.boolean(),
  moderateReviews: z.boolean(),
  live: z.object({
    enabled: z.boolean(),
    maxMinutes: z.number().int().min(10).max(600),
    slowSec: z.number().int().min(0).max(120),
    maxQueue: z.number().int().min(0).max(200),
    gifts: z.array(z.object({
      id: z.string().trim().regex(/^[a-z0-9-]{2,30}$/, "Gift id: lowercase letters, numbers, dashes"),
      name: z.string().trim().min(1).max(30),
      emoji: z.string().trim().min(1).max(8),
      price: z.number().int().min(1).max(100000),
    })).max(12).refine((g) => new Set(g.map((x) => x.id)).size === g.length, { message: "Gift ids must be unique" }),
    giftCombos: z.array(z.number().int().min(1).max(100)).min(1).max(4).default([1, 5, 10]),
    bigGiftAt: z.number().int().min(1).max(1_000_000).default(251),
    superChat: z.object({
      enabled: z.boolean(),
      tiers: z.array(z.object({ price: z.number().int().min(1).max(100_000), pinSec: z.number().int().min(10).max(3600) })).min(1).max(4),
    }).default({ enabled: true, tiers: [{ price: 51, pinSec: 60 }, { price: 101, pinSec: 120 }, { price: 251, pinSec: 300 }] }),
    blockedWords: z.array(z.string().trim().min(2).max(40)).max(300).default([]),
    autoMuteStrikes: z.number().int().min(0).max(20).default(3),
    quickReplies: z.array(z.string().trim().min(2).max(200)).max(12).default(DEFAULT_LIVE_TEXTS.quickReplies),
    askTemplates: z.array(z.string().trim().min(2).max(200)).max(12).default(DEFAULT_LIVE_TEXTS.askTemplates),
    video: z.object({
      enabled: z.boolean(),
      quality: z.enum(["540p", "720p"]),
      waitForViewers: z.boolean(),
      idleStopSec: z.number().int().min(30).max(900),
      allowAudioOnly: z.boolean(),
    }).default(DEFAULT_LIVE_VIDEO),
  }),
  payouts: z.object({
    provider: z.enum(["manual", "razorpayx"]),
    autoCreate: z.boolean(),
    cycleWeekday: z.number().int().min(0).max(6),
    requireVerifiedAccount: z.boolean(),
    maxPerRequest: z.number().int().min(0).max(10_000_000),
  }),
  tips: z.object({
    enabled: z.boolean(),
    presets: z.array(z.number().int().min(1).max(100_000)).min(1).max(6),
    maxPerChat: z.number().int().min(1).max(100_000),
    windowHours: z.number().int().min(1).max(720),
  }),
  waitlist: z.object({
    enabled: z.boolean(),
    maxSize: z.number().int().min(1).max(100),
    offerSec: z.number().int().min(20).max(600),
  }),
  firstChat: z.object({
    astrologerPayPct: z.number().int().min(0).max(100),
    maxRate: z.number().int().min(0).max(10000),
  }),
  referral: z.object({
    enabled: z.boolean(),
    referrerReward: z.number().int().min(0).max(5000),
    refereeReward: z.number().int().min(0).max(5000),
    minRecharge: z.number().int().min(1).max(100000),
    monthlyCap: z.number().int().min(0).max(1000),
    applyWithinDays: z.number().int().min(1).max(365),
    qualifyWithinDays: z.number().int().min(1).max(365),
  }),
  remedy: z.object({
    enabled: z.boolean(),
    commissionPct: z.number().min(0).max(50),
    attributionDays: z.number().int().min(1).max(60),
    confirmAfterDays: z.number().int().min(0).max(60),
    allowProducts: z.boolean(),
    allowPoojas: z.boolean(),
    maxPerChat: z.number().int().min(1).max(20),
    maxCommission: z.number().int().min(0).max(1_000_000),
  }),
  push: z.object({
    enabled: z.boolean(),
    groups: z.object({ live: z.boolean(), reminders: z.boolean(), chat: z.boolean(), wallet: z.boolean(), orders: z.boolean() }),
    quietStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24 hour)"),
    quietEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24 hour)"),
    liveDailyCap: z.number().int().min(0).max(50),
    liveFanoutMax: z.number().int().min(10).max(1_000_000),
    chatCooldownSec: z.number().int().min(10).max(3600),
  }),
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
  live: {
    ...DEFAULT_ASTRO_SETTINGS.live, ...(stored?.live ?? {}),
    superChat: { ...DEFAULT_ASTRO_SETTINGS.live.superChat, ...(stored?.live?.superChat ?? {}) },
    video: { ...DEFAULT_LIVE_VIDEO, ...(stored?.live?.video ?? {}) },
  },
  payouts: { ...DEFAULT_ASTRO_SETTINGS.payouts, ...(stored?.payouts ?? {}) },
  tips: { ...DEFAULT_ASTRO_SETTINGS.tips, ...(stored?.tips ?? {}) },
  waitlist: { ...DEFAULT_ASTRO_SETTINGS.waitlist, ...(stored?.waitlist ?? {}) },
  referral: { ...DEFAULT_ASTRO_SETTINGS.referral, ...(stored?.referral ?? {}) },
  firstChat: { ...DEFAULT_ASTRO_SETTINGS.firstChat, ...(stored?.firstChat ?? {}) },
  remedy: { ...DEFAULT_ASTRO_SETTINGS.remedy, ...(stored?.remedy ?? {}) },
  push: { ...DEFAULT_ASTRO_SETTINGS.push, ...(stored?.push ?? {}), groups: { ...DEFAULT_ASTRO_SETTINGS.push.groups, ...(stored?.push?.groups ?? {}) } },
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
