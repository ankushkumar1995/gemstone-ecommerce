import "server-only";

/**
 * Earnings — Mongoose models.
 *
 *  astro_ledger         append-only money rows, unique `key` (idempotent writes)
 *  astro_payouts        withdrawal requests; `openKey` = astrologerId while the
 *                       payout is not finished → one open payout per astrologer
 *  astro_rzpx_accounts  RazorpayX contact / fund account per payout destination
 *  astro_jobs           run-once markers for scheduled jobs (weekly payouts)
 */

import { Schema, deleteModel, model, models, type Model } from "mongoose";

const Mixed = Schema.Types.Mixed;
type AnyDoc = Record<string, unknown>;

const LedgerSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    astrologerId: { type: String, required: true },
    type: { type: String, required: true },
    grossPaise: { type: Number, default: 0 },
    commissionPaise: { type: Number, default: 0 },
    netPaise: { type: Number, required: true },
    availableAt: { type: String, required: true },
    at: { type: String, required: true },
    ref: Mixed,
    note: { type: String, default: "" },
    actor: { type: String, default: "System" },
  },
  { collection: "astro_ledger", versionKey: false },
);
LedgerSchema.index({ astrologerId: 1, at: -1 });
LedgerSchema.index({ astrologerId: 1, availableAt: 1 });
LedgerSchema.index({ type: 1, at: -1 });

const PayoutSchema = new Schema(
  {
    payoutNumber: { type: String, required: true, unique: true },
    requestId: { type: String, required: true, unique: true },
    astrologerId: { type: String, required: true, index: true },
    astrologer: Mixed,
    amountPaise: { type: Number, required: true },
    tdsRatePct: { type: Number, default: 0 },
    tdsPaise: { type: Number, default: 0 },
    netPaise: { type: Number, required: true },
    pan: { type: String, default: null },
    destination: Mixed,
    status: { type: String, required: true, index: true },
    openKey: { type: String, default: null },
    requestedBy: { type: String, required: true },
    provider: { type: String, default: "manual" },
    providerPayoutId: { type: String, default: null },
    providerStatus: { type: String, default: null },
    utr: { type: String, default: null },
    failureReason: { type: String, default: null },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    paidAt: { type: String, default: null },
    history: { type: Mixed, default: [] },
  },
  { collection: "astro_payouts", versionKey: false },
);
PayoutSchema.index({ openKey: 1 }, { unique: true, partialFilterExpression: { openKey: { $type: "string" } } });
PayoutSchema.index({ providerPayoutId: 1 }, { sparse: true });
PayoutSchema.index({ status: 1, createdAt: -1 });

const RzpxSchema = new Schema(
  { astrologerId: { type: String, required: true }, destHash: { type: String, required: true }, contactId: String, fundAccountId: String, at: String },
  { collection: "astro_rzpx_accounts", versionKey: false },
);
RzpxSchema.index({ astrologerId: 1, destHash: 1 }, { unique: true });

const JobSchema = new Schema({ key: { type: String, required: true, unique: true }, at: String, result: Mixed }, { collection: "astro_jobs", versionKey: false });

if (process.env.NODE_ENV !== "production") {
  for (const n of ["AstroLedger", "AstroPayout", "AstroRzpxAccount", "AstroJob"]) if (models[n]) deleteModel(n);
}

export const AstroLedgerModel: Model<AnyDoc> = (models.AstroLedger as Model<AnyDoc>) ?? model<AnyDoc>("AstroLedger", LedgerSchema);
export const AstroPayoutModel: Model<AnyDoc> = (models.AstroPayout as Model<AnyDoc>) ?? model<AnyDoc>("AstroPayout", PayoutSchema);
export const AstroRzpxAccountModel: Model<AnyDoc> = (models.AstroRzpxAccount as Model<AnyDoc>) ?? model<AnyDoc>("AstroRzpxAccount", RzpxSchema);
export const AstroJobModel: Model<AnyDoc> = (models.AstroJob as Model<AnyDoc>) ?? model<AnyDoc>("AstroJob", JobSchema);
