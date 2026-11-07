import "server-only";

/**
 * Astrologer — Mongoose model.
 *  • Auth + financial secrets are `select: false`: they are only loaded by the
 *    auth/payout code paths that explicitly ask for them.
 *  • Soft delete keeps history (sessions, payouts) intact.
 *  • Indexes match the real queries: storefront listing (status + hidden +
 *    online + featured), login by email, slug lookup.
 */

import { Schema, model, models, type Model, type InferSchemaType, type Types } from "mongoose";

const KycDocSchema = new Schema(
  {
    type: { type: String, enum: ["pan", "aadhaar", "photo_id", "certificate", "bank_proof"], required: true },
    fileKey: { type: String, trim: true },
    fileName: { type: String, trim: true, maxlength: 160 },
    numberMasked: { type: String, trim: true, maxlength: 40 },
    status: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
    note: { type: String, trim: true, maxlength: 500 },
    uploadedAt: { type: String, required: true },
    reviewedAt: { type: String },
    reviewedBy: { type: String, trim: true, maxlength: 120 },
  },
  { _id: false },
);

const PayoutSchema = new Schema(
  {
    method: { type: String, enum: ["bank", "upi"], default: "bank" },
    accountHolder: { type: String, trim: true, maxlength: 120 },
    accountNumberMasked: { type: String, trim: true, maxlength: 40 },
    ifsc: { type: String, trim: true, uppercase: true, maxlength: 20 },
    bankName: { type: String, trim: true, maxlength: 120 },
    upiId: { type: String, trim: true, lowercase: true, maxlength: 120 },
    verified: { type: Boolean, default: false },
  },
  { _id: false },
);

const SlotSchema = new Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    start: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    end: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
  },
  { _id: false },
);

const ActivitySchema = new Schema(
  {
    id: { type: String, required: true },
    at: { type: String, required: true },
    type: { type: String, enum: ["created", "status", "profile", "kyc", "presence", "note", "admin"], default: "note" },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    actor: { type: String, trim: true, maxlength: 120 },
  },
  { _id: false },
);

const channels = { chat: { type: Boolean, default: true }, call: { type: Boolean, default: false }, video: { type: Boolean, default: false } };

const AstrologerSchema = new Schema(
  {
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
    displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    legalName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 180 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    gender: { type: String, enum: ["male", "female", "other", null], default: null },
    city: { type: String, trim: true, maxlength: 80 },
    state: { type: String, trim: true, maxlength: 80 },
    photo: { type: String, trim: true, maxlength: 600 },
    shortBio: { type: String, trim: true, maxlength: 160 },
    bio: { type: String, trim: true, maxlength: 3000 },
    languages: { type: [String], default: [] },
    expertise: { type: [String], default: [], index: true },
    categories: { type: [String], default: [], index: true },
    experienceYears: { type: Number, min: 0, max: 80, default: 0 },
    education: { type: String, trim: true, maxlength: 300 },
    certifications: { type: String, trim: true, maxlength: 600 },
    rates: {
      chat: { type: Number, min: 0, default: 10 },
      call: { type: Number, min: 0, default: 15 },
      video: { type: Number, min: 0, default: 20 },
    },
    availability: { type: [SlotSchema], default: [] },
    timezone: { type: String, default: "Asia/Kolkata" },

    status: {
      type: String,
      enum: ["applied", "under_review", "approved", "rejected", "suspended", "deactivated"],
      default: "applied",
      index: true,
    },
    statusReason: { type: String, trim: true, maxlength: 500 },
    statusChangedAt: { type: String },
    appliedAt: { type: String, required: true },
    approvedAt: { type: String },
    approvedBy: { type: String, trim: true, maxlength: 120 },
    source: { type: String, enum: ["self", "invite"], default: "self" },

    kyc: { type: [KycDocSchema], default: [] },
    payout: { type: PayoutSchema, default: undefined },

    presence: {
      online: { type: Boolean, default: false, index: true },
      channels,
      busyWith: { type: String, default: null },
      lastHeartbeatAt: { type: String, default: null },
      onlineSince: { type: String, default: null },
    },
    stats: {
      rating: { type: Number, min: 0, max: 5, default: 0 },
      reviewCount: { type: Number, min: 0, default: 0 },
      totalSessions: { type: Number, min: 0, default: 0 },
      totalMinutes: { type: Number, min: 0, default: 0 },
      missedRequests: { type: Number, min: 0, default: 0 },
      missedStreak: { type: Number, min: 0, default: 0 },
      repeatCustomers: { type: Number, min: 0, default: 0 },
    },

    commissionPct: { type: Number, min: 0, max: 100, default: null },
    maxRate: { type: Number, min: 0, default: null },
    featured: { type: Boolean, default: false, index: true },
    sortWeight: { type: Number, default: 0 },
    badges: { type: [String], enum: ["vip", "trending", "topRated", "rising", "mostBooked"], default: [] },
    hidden: { type: Boolean, default: false },

    pendingChanges: {
      type: new Schema(
        {
          displayName: { type: String, trim: true, maxlength: 80 },
          photo: { type: String, trim: true, maxlength: 600 },
          shortBio: { type: String, trim: true, maxlength: 160 },
          bio: { type: String, trim: true, maxlength: 3000 },
          submittedAt: { type: String, required: true },
        },
        { _id: false },
      ),
      default: undefined,
    },
    adminNotes: { type: String, trim: true, maxlength: 4000 },
    mustChangePassword: { type: Boolean, default: false },
    lastLoginAt: { type: String, default: null },
    activity: { type: [ActivitySchema], default: [] },

    // ── Secrets (never selected by default) ──
    passwordHash: { type: String, select: false },
    tokenVersion: { type: Number, default: 0, select: false },
    refreshTokenHash: { type: String, select: false, default: null },
    failedLoginCount: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },
    passwordResetTokenHash: { type: String, select: false, default: null },
    passwordResetExpires: { type: Date, select: false, default: null },
    panNumber: { type: String, select: false, default: null },
    payoutAccountNumber: { type: String, select: false, default: null },

    // ── Soft delete ──
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  {
    collection: "astrologers",
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        for (const k of ["passwordHash", "tokenVersion", "refreshTokenHash", "failedLoginCount", "lockedUntil", "passwordResetTokenHash", "passwordResetExpires", "panNumber", "payoutAccountNumber"]) delete ret[k];
        return ret;
      },
    },
  },
);

AstrologerSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
AstrologerSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
AstrologerSchema.index({ isDeleted: 1, status: 1, hidden: 1, "presence.online": -1, featured: -1, sortWeight: -1 });

export type AstrologerDoc = InferSchemaType<typeof AstrologerSchema> & { _id: Types.ObjectId };

export const AstrologerModel: Model<AstrologerDoc> =
  (models.Astrologer as Model<AstrologerDoc>) ?? model<AstrologerDoc>("Astrologer", AstrologerSchema);
