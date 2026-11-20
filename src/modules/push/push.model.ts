import "server-only";

/**
 * Push notifications — Mongoose models.
 *
 *  push_devices  one row per Expo push token (unique). Re-registering the same
 *                token under another account moves it, so a shared phone only
 *                ever gets the signed-in person's notifications.
 *  push_prefs    one row per customer (groups on/off, quiet hours).
 *  push_outbox   one row per notification, unique `key` (idempotent). Also the
 *                customer's in-app inbox. TTL: deleted 60 days after creation.
 *  push_jobs     watermarks for the status watcher (orders / bookings).
 */

import { Schema, deleteModel, model, models, type Model } from "mongoose";

const Mixed = Schema.Types.Mixed;
type AnyDoc = Record<string, unknown>;

const DeviceSchema = new Schema(
  {
    token: { type: String, required: true, unique: true },
    customerId: { type: String, required: true },
    platform: { type: String, default: "android" },
    app: { type: String, default: "" },
    appVersion: { type: String, default: "" },
    deviceName: { type: String, default: "" },
    active: { type: Boolean, default: true },
    disabledReason: { type: String, default: null },
    createdAt: { type: String, required: true },
    lastSeenAt: { type: String, required: true },
  },
  { collection: "push_devices", versionKey: false },
);
DeviceSchema.index({ customerId: 1, active: 1 });

const PrefSchema = new Schema(
  { customerId: { type: String, required: true, unique: true }, groups: Mixed, quiet: Mixed, updatedAt: String },
  { collection: "push_prefs", versionKey: false },
);

const OutboxSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    customerId: { type: String, required: true },
    group: { type: String, required: true },
    kind: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    url: { type: String, default: "/" },
    data: { type: Mixed, default: {} },
    image: { type: String, default: null },
    channel: { type: String, default: "default" },
    tag: { type: String, default: null },
    urgent: { type: Boolean, default: false },
    inbox: { type: Boolean, default: false },
    ttlSec: { type: Number, default: null },
    status: { type: String, required: true },
    reason: { type: String, default: null },
    sendAfter: { type: String, required: true },
    expiresAt: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    leaseUntil: { type: String, default: null },
    tickets: { type: Mixed, default: [] },
    receiptsAt: { type: String, default: null },
    readAt: { type: String, default: null },
    createdAt: { type: String, required: true },
    sentAt: { type: String, default: null },
    /** Date copy of createdAt for the TTL index. */
    createdOn: { type: Date, required: true },
  },
  { collection: "push_outbox", versionKey: false },
);
OutboxSchema.index({ status: 1, sendAfter: 1 });
OutboxSchema.index({ customerId: 1, inbox: 1, createdAt: -1 });
OutboxSchema.index({ customerId: 1, group: 1, createdAt: -1 });
OutboxSchema.index({ status: 1, receiptsAt: 1, sentAt: 1 });
OutboxSchema.index({ createdOn: 1 }, { expireAfterSeconds: 60 * 86_400 });

const JobSchema = new Schema({ key: { type: String, required: true, unique: true }, since: String, at: String }, { collection: "push_jobs", versionKey: false });

if (process.env.NODE_ENV !== "production") {
  for (const n of ["PushDevice", "PushPref", "PushOutbox", "PushJob"]) if (models[n]) deleteModel(n);
}

export const PushDeviceModel: Model<AnyDoc> = (models.PushDevice as Model<AnyDoc>) ?? model<AnyDoc>("PushDevice", DeviceSchema);
export const PushPrefModel: Model<AnyDoc> = (models.PushPref as Model<AnyDoc>) ?? model<AnyDoc>("PushPref", PrefSchema);
export const PushOutboxModel: Model<AnyDoc> = (models.PushOutbox as Model<AnyDoc>) ?? model<AnyDoc>("PushOutbox", OutboxSchema);
export const PushJobModel: Model<AnyDoc> = (models.PushJob as Model<AnyDoc>) ?? model<AnyDoc>("PushJob", JobSchema);
