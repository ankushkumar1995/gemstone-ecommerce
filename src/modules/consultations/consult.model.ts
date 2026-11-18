import "server-only";

/**
 * Consultations — Mongoose models.
 *
 *  consult_sessions  one row per chat (request → active → ended). `openAstro`
 *                    / `openCustomer` hold the ids only while the session is
 *                    open; unique partial indexes on them make "one live
 *                    session per astrologer" and "one per customer" atomic
 *                    (a second request fails with a duplicate key).
 *  consult_messages  ordered by a per-session `seq` (atomic counter on the
 *                    session); `clientId` makes a re-sent message a no-op.
 *  consult_blocks    astrologer → customer blocks.
 */

import { Schema, deleteModel, model, models, type Model } from "mongoose";

const Mixed = Schema.Types.Mixed;
type AnyDoc = Record<string, unknown>;

const SessionSchema = new Schema(
  {
    sessionNumber: { type: String, required: true, unique: true },
    requestId: { type: String },
    channel: { type: String, required: true, default: "chat" },
    status: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    customer: Mixed,
    astrologerId: { type: String, required: true, index: true },
    astrologer: Mixed,
    intake: Mixed,
    question: String,
    rate: { type: Number, required: true },
    commissionPct: { type: Number, required: true },
    freeMinutes: { type: Number, default: 0 },
    openAstro: { type: String, default: null },
    openCustomer: { type: String, default: null },
    requestedAt: { type: String, required: true },
    expiresAt: { type: String, required: true },
    acceptedAt: { type: String, default: null },
    firstReplyAt: { type: String, default: null },
    billFrom: { type: String, default: null },
    endedAt: { type: String, default: null },
    endReason: { type: String, default: null },
    lastSeen: Mixed,
    typing: Mixed,
    read: Mixed,
    msgSeq: { type: Number, default: 0 },
    minutesCharged: { type: Number, default: 0 },
    freeUsed: { type: Number, default: 0 },
    chargedPaise: { type: Number, default: 0 },
    refundedPaise: { type: Number, default: 0 },
    earningPaise: { type: Number, default: 0 },
    platformPaise: { type: Number, default: 0 },
    lowBalance: { type: Boolean, default: false },
    rating: { type: Mixed, default: null },
    tipPaise: { type: Number, default: 0 },
    tips: { type: Mixed, default: [] },
    reports: { type: Mixed, default: [] },
    version: { type: Number, default: 1 },
  },
  { collection: "consult_sessions", timestamps: true, versionKey: false },
);
SessionSchema.index({ openAstro: 1 }, { unique: true, partialFilterExpression: { openAstro: { $type: "string" } } });
SessionSchema.index({ openCustomer: 1 }, { unique: true, partialFilterExpression: { openCustomer: { $type: "string" } } });
SessionSchema.index({ requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $type: "string" } } });
SessionSchema.index({ status: 1, expiresAt: 1 });
SessionSchema.index({ customerId: 1, requestedAt: -1 });
SessionSchema.index({ astrologerId: 1, requestedAt: -1 });
SessionSchema.index({ "rating.status": 1, astrologerId: 1 });

const MessageSchema = new Schema(
  {
    sessionId: { type: String, required: true },
    seq: { type: Number, required: true },
    from: { type: String, required: true },
    text: { type: String, required: true },
    masked: { type: Boolean, default: false },
    clientId: { type: String },
    at: { type: String, required: true },
  },
  { collection: "consult_messages", versionKey: false },
);
MessageSchema.index({ sessionId: 1, seq: 1 }, { unique: true });
MessageSchema.index({ sessionId: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: "string" } } });

const BlockSchema = new Schema(
  /** Astrologer blocked this customer for good: no chats, no waitlist, no comments / questions / gifts on any of their lives. `via` = chat | live. */
  { astrologerId: { type: String, required: true }, customerId: { type: String, required: true }, name: { type: String, default: "" }, via: { type: String, default: "chat" }, reason: String, at: String },
  { collection: "consult_blocks", versionKey: false },
);
BlockSchema.index({ astrologerId: 1, customerId: 1 }, { unique: true });

if (process.env.NODE_ENV !== "production") {
  if (models.ConsultSession) deleteModel("ConsultSession");
  if (models.ConsultMessage) deleteModel("ConsultMessage");
  if (models.ConsultBlock) deleteModel("ConsultBlock");
}

export const ConsultSessionModel: Model<AnyDoc> = (models.ConsultSession as Model<AnyDoc>) ?? model<AnyDoc>("ConsultSession", SessionSchema);
export const ConsultMessageModel: Model<AnyDoc> = (models.ConsultMessage as Model<AnyDoc>) ?? model<AnyDoc>("ConsultMessage", MessageSchema);
export const ConsultBlockModel: Model<AnyDoc> = (models.ConsultBlock as Model<AnyDoc>) ?? model<AnyDoc>("ConsultBlock", BlockSchema);
