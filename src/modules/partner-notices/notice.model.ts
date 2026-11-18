import "server-only";

/**
 * partner_notifications — one row per partner per event (kept 180 days).
 * partner_announcements — admin messages; fanned out as notifications so
 * every partner has a read state and the admin sees read counts.
 */

import { Schema, deleteModel, model, models, type Model } from "mongoose";

const NotificationSchema = new Schema(
  {
    astrologerId: { type: String, required: true },
    kind: { type: String, required: true, enum: ["kyc", "status", "profile", "agreement", "announcement", "system"] },
    title: { type: String, required: true, maxlength: 140 },
    body: { type: String, required: true, maxlength: 2000 },
    link: { type: String, maxlength: 200 },
    announcementId: { type: String, default: null },
    readAt: { type: Date, default: null },
    createdAt: { type: Date, required: true },
    expireAt: { type: Date, required: true },
  },
  { collection: "partner_notifications", versionKey: false },
);
NotificationSchema.index({ astrologerId: 1, createdAt: -1 });
NotificationSchema.index({ astrologerId: 1, readAt: 1 });
NotificationSchema.index({ announcementId: 1, readAt: 1 });
NotificationSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const AnnouncementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    audience: { type: String, required: true, enum: ["all", "approved"] },
    pinned: { type: Boolean, default: false },
    status: { type: String, required: true, enum: ["published", "archived"], default: "published" },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, required: true },
    archivedAt: { type: Date, default: null },
    sentTo: { type: Number, default: 0 },
  },
  { collection: "partner_announcements", versionKey: false },
);
AnnouncementSchema.index({ status: 1, createdAt: -1 });

if (process.env.NODE_ENV !== "production") {
  for (const n of ["PartnerNotification", "PartnerAnnouncement"]) if (models[n]) deleteModel(n);
}
export const NotificationModel: Model<Record<string, unknown>> =
  (models.PartnerNotification as Model<Record<string, unknown>>) ?? model("PartnerNotification", NotificationSchema);
export const AnnouncementModel: Model<Record<string, unknown>> =
  (models.PartnerAnnouncement as Model<Record<string, unknown>>) ?? model("PartnerAnnouncement", AnnouncementSchema);
