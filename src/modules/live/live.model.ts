import "server-only";

/**
 * Live — Mongoose models.
 *
 *  live_sessions  one row per live. `openAstro` holds the astrologer id only
 *                 while live; a unique partial index makes "one live per
 *                 astrologer" atomic.
 *  live_events    comments, gifts, joins, system lines; ordered by a per-live
 *                 `seq` (atomic counter on the session). `clientId` makes a
 *                 re-sent comment or gift a no-op.
 *  live_viewers   one row per (live, customer): presence for the viewer count.
 *  live_queue     "ask on live" questions. `openKey` is set while waiting or
 *                 being answered, so a customer holds one place at a time.
 */

import { Schema, deleteModel, model, models, type Model } from "mongoose";

const Mixed = Schema.Types.Mixed;
type AnyDoc = Record<string, unknown>;

const LiveSchema = new Schema(
  {
    liveNumber: { type: String, required: true, unique: true },
    astrologerId: { type: String, required: true, index: true },
    astrologer: Mixed,
    title: { type: String, required: true },
    topic: { type: String, default: "" },
    status: { type: String, required: true, index: true },
    scheduledAt: { type: String, default: null },
    startedAt: { type: String, default: null },
    endedAt: { type: String, default: null },
    endReason: { type: String, default: null },
    openAstro: { type: String, default: null },
    lastBeatAt: { type: String, default: null },
    commissionPct: { type: Number, required: true },
    seq: { type: Number, default: 0 },
    version: { type: Number, default: 1 },
    likes: { type: Number, default: 0 },
    giftCount: { type: Number, default: 0 },
    giftsPaise: { type: Number, default: 0 },
    earningPaise: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    peakViewers: { type: Number, default: 0 },
    uniqueViewers: { type: Number, default: 0 },
    pinned: { type: Mixed, default: null },
    answering: { type: Mixed, default: null },
    commentsOff: { type: Boolean, default: false },
    slowSec: { type: Number, default: 3 },
    queueOpen: { type: Boolean, default: true },
    muted: { type: [String], default: [] },
    hiddenSeqs: { type: [Number], default: [] },
    stream: { type: Mixed, default: null },
    superPin: { type: Mixed, default: null },
    superChatCount: { type: Number, default: 0 },
    superChatPaise: { type: Number, default: 0 },
    reminderCount: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    featured: { type: Boolean, default: false },
    featuredAt: { type: String, default: null },
    chatLeads: { type: Number, default: 0 },
    /** Seconds the HLS recorder ran (LiveKit bills these minutes). */
    videoSeconds: { type: Number, default: 0 },
    /** Watching count about once a minute while live (the report graph). */
    viewerSamples: { type: [{ _id: false, at: String, n: Number }], default: [] },
    lastSampleAt: { type: String, default: null },
  },
  { collection: "live_sessions", timestamps: true, versionKey: false },
);
LiveSchema.index({ openAstro: 1 }, { unique: true, partialFilterExpression: { openAstro: { $type: "string" } } });
LiveSchema.index({ status: 1, startedAt: -1 });
LiveSchema.index({ status: 1, scheduledAt: 1 });
LiveSchema.index({ astrologerId: 1, createdAt: -1 });

const EventSchema = new Schema(
  {
    liveId: { type: String, required: true },
    seq: { type: Number, required: true },
    kind: { type: String, required: true },
    by: { type: String, required: true },
    customerId: { type: String, default: null },
    name: { type: String, default: "" },
    text: { type: String, default: "" },
    gift: { type: Mixed, default: null },
    clientId: { type: String },
    /** Caught by the word filter: only the sender sees it. */
    shadow: { type: Boolean, default: false },
    at: { type: String, required: true },
  },
  { collection: "live_events", versionKey: false },
);
EventSchema.index({ liveId: 1, seq: 1 }, { unique: true });
EventSchema.index({ liveId: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: "string" } } });

const ViewerSchema = new Schema(
  {
    liveId: { type: String, required: true },
    customerId: { type: String, required: true },
    name: { type: String, default: "" },
    joinedAt: { type: String, required: true },
    lastSeen: { type: String, required: true },
    lastCommentAt: { type: String, default: null },
    likes: { type: Number, default: 0 },
    /** Comments the filter hid in this live (auto mute at the admin limit). */
    strikes: { type: Number, default: 0 },
    /** Last few comments (normalised) to stop the same text being pasted again. */
    recent: { type: [{ _id: false, t: String, at: String }], default: [] },
  },
  { collection: "live_viewers", versionKey: false },
);
ViewerSchema.index({ liveId: 1, customerId: 1 }, { unique: true });
ViewerSchema.index({ liveId: 1, lastSeen: -1 });

const QueueSchema = new Schema(
  {
    liveId: { type: String, required: true, index: true },
    customerId: { type: String, required: true },
    name: { type: String, default: "" },
    question: { type: String, required: true },
    status: { type: String, required: true },
    openKey: { type: String, default: null },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    /** Super Chat: paid for priority. `paidSplit` = wallet buckets charged (refund goes back the same way). */
    paidPaise: { type: Number, default: 0 },
    paidSplit: { type: Mixed, default: null },
    paidKey: { type: String, default: null },
    paidState: { type: String, default: "none" },
    /** Tie-break inside the same amount: arrival, or payment time when upgraded. */
    rankAt: { type: String, default: null },
  },
  { collection: "live_queue", versionKey: false },
);
QueueSchema.index({ openKey: 1 }, { unique: true, partialFilterExpression: { openKey: { $type: "string" } } });
QueueSchema.index({ liveId: 1, status: 1, paidPaise: -1, rankAt: 1 });

/** "Remind me" on a scheduled live. */
const ReminderSchema = new Schema(
  { liveId: { type: String, required: true }, customerId: { type: String, required: true }, astrologerId: { type: String, required: true }, at: { type: String, required: true } },
  { collection: "live_reminders", versionKey: false },
);
ReminderSchema.index({ liveId: 1, customerId: 1 }, { unique: true });
ReminderSchema.index({ customerId: 1 });

/** Customer follows an astrologer (live alerts, story order). */
const FollowSchema = new Schema(
  { customerId: { type: String, required: true }, astrologerId: { type: String, required: true }, name: { type: String, default: "" }, via: { type: String, default: "profile" }, alerts: { type: Boolean, default: true }, at: { type: String, required: true } },
  { collection: "astro_follows", versionKey: false },
);
FollowSchema.index({ customerId: 1, astrologerId: 1 }, { unique: true });
FollowSchema.index({ astrologerId: 1, at: -1 });

if (process.env.NODE_ENV !== "production") {
  for (const n of ["LiveSession", "LiveEvent", "LiveViewer", "LiveQueue", "LiveReminder", "AstroFollow"]) if (models[n]) deleteModel(n);
}

export const LiveSessionModel: Model<AnyDoc> = (models.LiveSession as Model<AnyDoc>) ?? model<AnyDoc>("LiveSession", LiveSchema);
export const LiveEventModel: Model<AnyDoc> = (models.LiveEvent as Model<AnyDoc>) ?? model<AnyDoc>("LiveEvent", EventSchema);
export const LiveViewerModel: Model<AnyDoc> = (models.LiveViewer as Model<AnyDoc>) ?? model<AnyDoc>("LiveViewer", ViewerSchema);
export const LiveQueueModel: Model<AnyDoc> = (models.LiveQueue as Model<AnyDoc>) ?? model<AnyDoc>("LiveQueue", QueueSchema);
export const LiveReminderModel: Model<AnyDoc> = (models.LiveReminder as Model<AnyDoc>) ?? model<AnyDoc>("LiveReminder", ReminderSchema);
export const AstroFollowModel: Model<AnyDoc> = (models.AstroFollow as Model<AnyDoc>) ?? model<AnyDoc>("AstroFollow", FollowSchema);
