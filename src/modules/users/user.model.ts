import "server-only";

/**
 * AdminUser — Mongoose model (single source of truth for the DB schema).
 * ─────────────────────────────────────────────────────────────────────
 * Production shape, built deep so any future action on a user is possible
 * without a migration: block / suspend (with reason + who + when), role change
 * with privilege rules, invite flow, password reset, login history, soft
 * delete + restore, and full audit (createdBy / updatedBy / deletedBy).
 *
 * Key decisions:
 *  • `_id` is a Mongo-generated ObjectId — we never supply our own id.
 *  • Secrets (passwordHash, inviteToken, resetToken) use `select: false` so
 *    they are NEVER returned unless a query explicitly asks — they can't leak
 *    into an API response.
 *  • `toJSON` exposes `id` (string) and strips `_id`, `__v`, and every secret
 *    as a defensive backstop.
 *  • Indexes are shaped around the real admin queries (list, filter, lookup).
 */

import { Schema, model, models, type Model, type InferSchemaType, type Types } from "mongoose";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UserSchema = new Schema(
  {
    /* ── Identity ─────────────────────────────────────────── */
    name: { type: String, required: [true, "name is required"], trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: [true, "email is required"],
      lowercase: true,
      trim: true,
      maxlength: 160,
      match: [EMAIL_RE, "enter a valid email"],
    },
    phone: { type: String, trim: true, maxlength: 20, default: "" },
    avatarUrl: { type: String, trim: true, default: "" },
    avatarColor: { type: String, trim: true, default: "" },

    /* ── Access control ───────────────────────────────────── */
    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true, index: true },
    status: {
      type: String,
      enum: ["active", "invited", "disabled", "suspended"],
      default: "invited",
      index: true,
    },

    /* ── Auth ─────────────────────────────────────────────── */
    passwordHash: { type: String, select: false },
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: { type: Date, default: null },
    /** Bumped to invalidate ALL issued tokens (logout-everywhere / password change). */
    tokenVersion: { type: Number, default: 0 },
    /** SHA-256 of the current refresh token (rotation) — select:false. */
    refreshTokenHash: { type: String, select: false, default: null },
    /** Device fingerprint the current refresh token is bound to. */
    refreshFingerprint: { type: String, select: false, default: null },

    /* ── Login tracking ───────────────────────────────────── */
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
    lastSeenAt: { type: Date, default: null },
    loginCount: { type: Number, default: 0, min: 0 },

    /* ── Security / lockout / suspension ──────────────────── */
    failedLoginCount: { type: Number, default: 0, min: 0 },
    lockedUntil: { type: Date, default: null },
    suspendedReason: { type: String, default: null },
    suspendedAt: { type: Date, default: null },
    suspendedBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },

    /* ── Invite flow ──────────────────────────────────────── */
    inviteToken: { type: String, select: false, default: null },
    inviteTokenExpires: { type: Date, default: null },
    invitedBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
    acceptedAt: { type: Date, default: null },

    /* ── Password reset ───────────────────────────────────── */
    resetToken: { type: String, select: false, default: null },
    resetTokenExpires: { type: Date, default: null },

    /* ── Preferences ──────────────────────────────────────── */
    timezone: { type: String, default: "Asia/Kolkata" },
    locale: { type: String, default: "en-IN" },

    /* ── Soft delete ──────────────────────────────────────── */
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },

    /* ── Audit ────────────────────────────────────────────── */
    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
  },
  {
    collection: "users",
    timestamps: true, // createdAt + updatedAt
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        // Defensive: never serialize secrets even if a query selected them.
        delete ret.passwordHash;
        delete ret.inviteToken;
        delete ret.resetToken;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

/* ── Indexes shaped around real queries ─────────────────────────────────────
 * - email unique, but only among NON-deleted users (so a deleted user's email
 *   can be reused). Partial unique index does exactly that.
 * - admin list: filter by status/role, newest first.
 * - sparse-unique on tokens so invite/reset lookups are indexed and collision-free.
 */
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
UserSchema.index({ isDeleted: 1, status: 1, createdAt: -1 });
UserSchema.index({ isDeleted: 1, roleId: 1 });
UserSchema.index(
  { inviteToken: 1 },
  { unique: true, partialFilterExpression: { inviteToken: { $type: "string" } } },
);
UserSchema.index(
  { resetToken: 1 },
  { unique: true, partialFilterExpression: { resetToken: { $type: "string" } } },
);

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: Types.ObjectId };

export const UserModel: Model<UserDoc> =
  (models.AdminUser as Model<UserDoc>) ?? model<UserDoc>("AdminUser", UserSchema);
