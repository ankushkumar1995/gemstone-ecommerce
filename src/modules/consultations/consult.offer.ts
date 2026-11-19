import "server-only";

/**
 * First-chat offer: a brand-new customer's first chat starts with free minutes
 * (program settings → Free minutes on first session; 0 = offer off).
 *
 * Who gets it
 *   • never had a chat with counted minutes (free or paid), and
 *   • their verified phone number never used the offer before, even on a
 *     deleted account (one offer per phone, stored as a hash).
 * Which astrologers
 *   • everyone, unless the astrologer opted out in the partner panel, and
 *     their chat rate is at most `firstChat.maxRate` (0 = any rate).
 * Who pays
 *   • the customer pays nothing for the free minutes; the platform pays the
 *     astrologer `firstChat.astrologerPayPct` % of their normal earning for
 *     each free minute, so these chats are worth taking.
 */

import crypto from "node:crypto";
import { Schema, deleteModel, model, models, type Model } from "mongoose";
import { cache } from "@/core/cache";
import { astroSettingsService } from "@/modules/astro-settings";

type AnyDoc = Record<string, unknown>;

const PrefSchema = new Schema({ astrologerId: { type: String, required: true, unique: true }, firstChat: { type: Boolean, default: true }, at: String }, { collection: "consult_offer_prefs", versionKey: false });
const UseSchema = new Schema(
  { phoneHash: { type: String, required: true, unique: true }, customerId: { type: String, required: true }, sessionId: { type: String, required: true }, freeMinutes: Number, at: { type: String, required: true } },
  { collection: "consult_offer_uses", versionKey: false },
);
UseSchema.index({ customerId: 1 });

if (process.env.NODE_ENV !== "production") {
  for (const n of ["ConsultOfferPref", "ConsultOfferUse"]) if (models[n]) deleteModel(n);
}
const PrefModel: Model<AnyDoc> = (models.ConsultOfferPref as Model<AnyDoc>) ?? model<AnyDoc>("ConsultOfferPref", PrefSchema);
const UseModel: Model<AnyDoc> = (models.ConsultOfferUse as Model<AnyDoc>) ?? model<AnyDoc>("ConsultOfferUse", UseSchema);

async function db() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return { PrefModel, UseModel };
}

const OPTED_OUT_KEY = "offer:optedOut";
const phoneHash = (phone: string) => crypto.createHash("sha256").update(`au-offer:${phone.replace(/[^\d+]/g, "")}`).digest("hex");

async function customerPhone(customerId: string): Promise<string | null> {
  if (!/^[a-f0-9]{24}$/i.test(customerId)) return null;
  const { CustomerModel } = await import("@/modules/customers/customer.model");
  const c = await CustomerModel.findById(customerId).select("phone phoneVerified").lean<AnyDoc>();
  return c?.phoneVerified && typeof c.phone === "string" && c.phone ? c.phone : null;
}

/** Astrologers who opted out of offer chats (cached; the list is small). */
async function optedOut(): Promise<string[]> {
  const hit = cache.get<string[]>(OPTED_OUT_KEY);
  if (hit) return hit;
  const { PrefModel: P } = await db();
  const ids = (await P.find({ firstChat: false }).select("astrologerId").limit(5000).lean<AnyDoc[]>()).map((d) => d.astrologerId as string);
  cache.set(OPTED_OUT_KEY, ids, 60);
  return ids;
}

export interface FirstChatOffer {
  /** Offer is on (free minutes > 0). */
  enabled: boolean;
  freeMinutes: number;
  /** ₹/min cap for offer astrologers (0 = any). */
  maxRate: number;
  /** Signed-in customer can use it now. Null for a guest (show it as an invitation). */
  eligible: boolean | null;
  /** Astrologers not taking offer chats (the app hides the badge on them). */
  optedOut: string[];
}

export const firstChatOffer = {
  /** Can this customer get the offer? (Settings check is done by the caller.) */
  async eligible(customerId: string): Promise<boolean> {
    const { ConsultSessionModel } = await import("./consult.model");
    if (await ConsultSessionModel.exists({ customerId, status: "ended", minutesCharged: { $gt: 0 } })) return false;
    const { UseModel: U } = await db();
    if (await U.exists({ customerId })) return false;
    const phone = await customerPhone(customerId);
    if (phone && (await U.exists({ phoneHash: phoneHash(phone) }))) return false;
    return true;
  },

  /** Does this astrologer take offer chats at this rate? */
  async takes(astrologerId: string, rate: number): Promise<boolean> {
    const st = await astroSettingsService.get();
    if (st.firstChat.maxRate > 0 && rate > st.firstChat.maxRate) return false;
    return !(await optedOut()).includes(astrologerId);
  },

  /** For the app: offer details + whether this customer can use it. */
  async view(customerId: string | null): Promise<FirstChatOffer> {
    const st = await astroSettingsService.get();
    const enabled = st.firstSessionFreeMinutes > 0;
    return {
      enabled, freeMinutes: enabled ? st.firstSessionFreeMinutes : 0, maxRate: st.firstChat.maxRate,
      eligible: !enabled ? false : customerId ? await this.eligible(customerId) : null,
      optedOut: enabled ? await optedOut() : [],
    };
  },

  /** A chat that used free minutes ended: this phone / account has had its offer. */
  async recordUse(s: { id: string; customerId: string; freeUsed: number }): Promise<void> {
    if (s.freeUsed <= 0) return;
    const { UseModel: U } = await db();
    const phone = await customerPhone(s.customerId);
    const key = phone ? phoneHash(phone) : `customer:${s.customerId}`;
    try {
      await U.create({ phoneHash: key, customerId: s.customerId, sessionId: s.id, freeMinutes: s.freeUsed, at: new Date().toISOString() });
    } catch (e) {
      if ((e as { code?: number })?.code !== 11000) throw e;
    }
  },

  /* ---------- astrologer ---------- */
  async pref(astrologerId: string): Promise<{ firstChat: boolean }> {
    const { PrefModel: P } = await db();
    const d = await P.findOne({ astrologerId }).lean<AnyDoc>();
    return { firstChat: d ? d.firstChat !== false : true };
  },
  async setPref(astrologerId: string, firstChat: boolean): Promise<{ firstChat: boolean }> {
    const { PrefModel: P } = await db();
    await P.updateOne({ astrologerId }, { $set: { firstChat, at: new Date().toISOString() } }, { upsert: true });
    cache.del(OPTED_OUT_KEY);
    return { firstChat };
  },
};
