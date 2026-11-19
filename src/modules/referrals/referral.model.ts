import "server-only";

/**
 * Refer a friend — Mongoose models.
 *
 *  referral_codes  one personal code per customer (made the first time they open Refer).
 *  referrals       one row per friend who entered a code (unique `refereeId`: a
 *                  customer can be referred only once, ever).
 */

import { Schema, deleteModel, model, models, type Model } from "mongoose";

type AnyDoc = Record<string, unknown>;

const CodeSchema = new Schema(
  { customerId: { type: String, required: true, unique: true }, code: { type: String, required: true, unique: true }, createdAt: { type: String, required: true } },
  { collection: "referral_codes", versionKey: false },
);

const ReferralSchema = new Schema(
  {
    referrerId: { type: String, required: true },
    refereeId: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    referrerName: { type: String, default: "" },
    refereeName: { type: String, default: "" },
    /**
     * pending   code entered, waiting for the friend's qualifying recharge
     * qualified recharge seen, bonuses being credited (the sweep finishes it if interrupted)
     * review    held for an admin check (looked like misuse); no bonus until approved
     * rewarded  bonuses credited
     * expired   no qualifying recharge in time
     * rejected  turned down by an admin
     */
    status: { type: String, required: true },
    /** Bonuses fixed when the code was entered (later setting changes do not affect it). */
    referrerRewardPaise: { type: Number, required: true },
    refereeRewardPaise: { type: Number, required: true },
    minRechargePaise: { type: Number, required: true },
    /** The referrer was over the monthly limit: only the friend gets a bonus. */
    referrerCapped: { type: Boolean, default: false },
    flags: { type: [String], default: [] },
    ip: { type: String, default: "" },
    appliedAt: { type: String, required: true },
    expiresAt: { type: String, required: true },
    qualifiedAt: { type: String, default: null },
    rewardedAt: { type: String, default: null },
    rechargeId: { type: String, default: null },
    rechargePaise: { type: Number, default: 0 },
    /** Month the referrer's bonus counts toward (YYYY-MM, IST). */
    rewardMonth: { type: String, default: null },
    reviewNote: { type: String, default: "" },
    reviewedBy: { type: String, default: "" },
  },
  { collection: "referrals", versionKey: false },
);
ReferralSchema.index({ referrerId: 1, appliedAt: -1 });
ReferralSchema.index({ referrerId: 1, rewardMonth: 1, referrerCapped: 1 });
ReferralSchema.index({ status: 1, appliedAt: -1 });
ReferralSchema.index({ referrerId: 1, ip: 1, appliedAt: -1 });

if (process.env.NODE_ENV !== "production") {
  for (const n of ["ReferralCode", "Referral"]) if (models[n]) deleteModel(n);
}

export const ReferralCodeModel: Model<AnyDoc> = (models.ReferralCode as Model<AnyDoc>) ?? model<AnyDoc>("ReferralCode", CodeSchema);
export const ReferralModel: Model<AnyDoc> = (models.Referral as Model<AnyDoc>) ?? model<AnyDoc>("Referral", ReferralSchema);
