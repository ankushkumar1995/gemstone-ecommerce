import "server-only";

/** customer_otps — phone sign-in codes (hash only). Rows auto-delete after 2 h (limits still count meanwhile). */

import { Schema, deleteModel, model, models, type Model } from "mongoose";

const OtpSchema = new Schema(
  {
    phone: { type: String, required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    lockedUntil: { type: Date, default: null },
    consumedAt: { type: Date, default: null },
    ip: { type: String, default: "" },
    deviceId: { type: String, default: "" },
    delivered: { type: Boolean, default: false },
    purgeAt: { type: Date, required: true },
  },
  { collection: "customer_otps", versionKey: false },
);
OtpSchema.index({ phone: 1, createdAt: -1 });
OtpSchema.index({ ip: 1, createdAt: -1 });
OtpSchema.index({ deviceId: 1, createdAt: -1 });
OtpSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

if (process.env.NODE_ENV !== "production" && models.CustomerOtp) deleteModel("CustomerOtp");
export const OtpModel: Model<Record<string, unknown>> =
  (models.CustomerOtp as Model<Record<string, unknown>>) ?? model("CustomerOtp", OtpSchema);
