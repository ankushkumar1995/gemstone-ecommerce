import "server-only";

/**
 * Role — Mongoose model (RBAC roles as a real collection).
 * ─────────────────────────────────────────────────────────
 * Promoting roles from code-constants to a collection means custom roles can
 * be added later with zero schema change. Each role is a named bundle of
 * `resource:action` permissions. `priority` powers privilege rules (a user can
 * never act on, or grant, a role with higher-or-equal priority than their own).
 *
 * `key` is the stable identifier used in code/seed (e.g. "owner"); `_id` is a
 * Mongo-generated ObjectId (we never supply our own id).
 */

import { Schema, model, models, type Model, type InferSchemaType, type Types } from "mongoose";

const RoleSchema = new Schema(
  {
    key: {
      type: String,
      required: [true, "role key is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_]+$/, "key must be lowercase letters, numbers or underscores"],
    },
    name: { type: String, required: [true, "name is required"], trim: true, maxlength: 60 },
    description: { type: String, default: "", maxlength: 240 },
    permissions: {
      type: [String],
      default: [],
      // Each entry is "resource:action" or the "*:*" superuser wildcard.
      validate: {
        validator: (arr: string[]) =>
          arr.every((p) => p === "*:*" || /^[a-z]+:(view|create|edit|delete|\*)$/.test(p)),
        message: "permissions must be 'resource:action' or '*:*'",
      },
    },
    /** Preset roles cannot be edited or deleted from the UI. */
    isSystem: { type: Boolean, default: false, index: true },
    /** Higher = more powerful. Owner highest. Used by privilege rules. */
    priority: { type: Number, default: 0, index: true },
  },
  {
    collection: "roles",
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

export type RoleDoc = InferSchemaType<typeof RoleSchema> & { _id: Types.ObjectId };

export const RoleModel: Model<RoleDoc> =
  (models.Role as Model<RoleDoc>) ?? model<RoleDoc>("Role", RoleSchema);
