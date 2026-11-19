import "server-only";

/**
 * Remedy suggestions — Mongoose models.
 *
 *  remedy_suggestions  one row per card sent in a chat. Unique (sessionId,
 *                      clientId) makes a retried send a no-op; unique
 *                      (sessionId, kind, itemId) stops the same item twice in one chat.
 *  remedy_sales        one row per attributed purchase. Unique `key`
 *                      (order:<orderId>:<productId> / pooja:<bookingId>) so a
 *                      purchase is never counted twice.
 */

import { Schema, deleteModel, model, models, type Model } from "mongoose";

const Mixed = Schema.Types.Mixed;
type AnyDoc = Record<string, unknown>;

const SuggestionSchema = new Schema(
  {
    sessionId: { type: String, required: true },
    sessionNumber: String,
    astrologerId: { type: String, required: true },
    astrologerName: String,
    customerId: { type: String, required: true },
    customerName: String,
    kind: { type: String, required: true },
    itemId: { type: String, required: true },
    slug: String,
    name: String,
    image: String,
    price: Number,
    mrp: { type: Number, default: null },
    note: { type: String, default: "" },
    commissionPct: { type: Number, required: true },
    maxCommissionPaise: { type: Number, default: 0 },
    clientId: { type: String, required: true },
    msgSeq: { type: Number, default: null },
    at: { type: String, required: true },
    expiresAt: { type: String, required: true },
    sales: { type: Number, default: 0 },
  },
  { collection: "remedy_suggestions", versionKey: false },
);
SuggestionSchema.index({ sessionId: 1, clientId: 1 }, { unique: true });
SuggestionSchema.index({ sessionId: 1, kind: 1, itemId: 1 }, { unique: true });
SuggestionSchema.index({ customerId: 1, expiresAt: -1 });
SuggestionSchema.index({ expiresAt: 1 });
SuggestionSchema.index({ astrologerId: 1, at: -1 });

const SaleSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    suggestionId: { type: String, required: true },
    sessionId: String,
    sessionNumber: String,
    astrologerId: { type: String, required: true },
    astrologerName: String,
    customerId: { type: String, required: true },
    customerName: String,
    kind: String,
    itemId: String,
    itemName: String,
    image: String,
    source: Mixed,
    qty: Number,
    basePaise: Number,
    commissionPct: Number,
    commissionPaise: Number,
    status: { type: String, required: true },
    confirmAt: { type: String, default: null },
    confirmedAt: { type: String, default: null },
    /** Set once the ledger row exists (the sweep retries until it is). */
    ledgerAt: { type: String, default: null },
    reversedAt: { type: String, default: null },
    reason: { type: String, default: "" },
    boughtAt: String,
    createdAt: { type: String, required: true },
    history: { type: Mixed, default: [] },
  },
  { collection: "remedy_sales", versionKey: false },
);
SaleSchema.index({ astrologerId: 1, createdAt: -1 });
SaleSchema.index({ status: 1, createdAt: -1 });
SaleSchema.index({ status: 1, confirmedAt: -1 });

if (process.env.NODE_ENV !== "production") {
  for (const n of ["RemedySuggestion", "RemedySale"]) if (models[n]) deleteModel(n);
}

export const RemedySuggestionModel: Model<AnyDoc> = (models.RemedySuggestion as Model<AnyDoc>) ?? model<AnyDoc>("RemedySuggestion", SuggestionSchema);
export const RemedySaleModel: Model<AnyDoc> = (models.RemedySale as Model<AnyDoc>) ?? model<AnyDoc>("RemedySale", SaleSchema);
