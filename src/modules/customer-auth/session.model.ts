import "server-only";

/**
 * customer_sessions — one row per signed-in device (web browser, Android, iOS).
 * Lets a customer stay signed in on the website and the app at the same time,
 * see their devices, and sign one out without touching the others.
 *
 * Refresh tokens are opaque (`<sessionId>.<random>`); only their SHA-256 is
 * stored. `prevRefreshHash` + `prevValidUntil` give a short grace window so a
 * refresh response lost on a flaky mobile network does not log the user out.
 */

import { Schema, deleteModel, model, models, type Model } from "mongoose";

const SessionSchema = new Schema(
  {
    customerId: { type: String, required: true },
    refreshHash: { type: String, required: true },
    prevRefreshHash: { type: String, default: null },
    prevValidUntil: { type: Date, default: null },
    client: { type: String, required: true, enum: ["web", "android", "ios"] },
    deviceId: { type: String, required: true, maxlength: 100 },
    deviceName: { type: String, default: "", maxlength: 120 },
    appVersion: { type: String, default: "", maxlength: 30 },
    ipFirst: { type: String, default: "" },
    ipLast: { type: String, default: "" },
    createdAt: { type: Date, required: true },
    lastUsedAt: { type: Date, required: true },
    /** Sliding: pushed forward on each refresh, never past hardExpiresAt. */
    expiresAt: { type: Date, required: true },
    hardExpiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokeReason: { type: String, default: null },
  },
  { collection: "customer_sessions", versionKey: false },
);
SessionSchema.index({ customerId: 1, revokedAt: 1, lastUsedAt: -1 });
SessionSchema.index({ customerId: 1, deviceId: 1 });
// Mongo deletes a row once its expiry passes (revoked rows expire too).
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 86400 });

if (process.env.NODE_ENV !== "production" && models.CustomerSession) deleteModel("CustomerSession");
export const SessionModel: Model<Record<string, unknown>> =
  (models.CustomerSession as Model<Record<string, unknown>>) ?? model("CustomerSession", SessionSchema);
