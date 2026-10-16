import "server-only";

/**
 * Booking — Mongoose model (production schema, single source of truth).
 * ─────────────────────────────────────────────────────────────────────
 *  • `_id` is a native ObjectId; the app sees a string `id` via toJSON.
 *  • The service + customer are SNAPSHOTTED so later edits/deletes never
 *    mutate historical bookings.
 *  • `bookingNumber` is unique (human-facing ref, e.g. BK-2026-0042).
 *  • Soft delete so history + references stay intact.
 *  • Indexes shaped around real admin queries: by number, status, customer,
 *    service, date.
 */

import { Schema, model, models, type Model, type InferSchemaType, type Types } from "mongoose";

const IntakeSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    dob: { type: String, trim: true, maxlength: 20 },
    birthTime: { type: String, trim: true, maxlength: 20 },
    birthPlace: { type: String, trim: true, maxlength: 160 },
    gender: { type: String, enum: ["male", "female", "other", ""], default: "" },
    message: { type: String, trim: true, maxlength: 2000 },
  },
  { _id: false },
);

const PaymentSchema = new Schema(
  {
    provider: { type: String, enum: ["razorpay"], default: "razorpay" },
    razorpayOrderId: { type: String, trim: true, index: true },
    razorpayPaymentId: { type: String, trim: true },
    razorpaySignature: { type: String, trim: true },
    paidAt: { type: String },
  },
  { _id: false },
);

const ActivitySchema = new Schema(
  {
    id: { type: String, required: true },
    at: { type: String, required: true },
    type: { type: String, enum: ["created", "status", "payment", "note", "schedule"], default: "note" },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    actor: { type: String, trim: true, maxlength: 80 },
  },
  { _id: false },
);

const BookingSchema = new Schema(
  {
    bookingNumber: { type: String, required: true, trim: true, maxlength: 40 },

    // service snapshot
    serviceId: { type: String, required: true, index: true },
    serviceSlug: { type: String, trim: true, default: "" },
    serviceTitle: { type: String, required: true, trim: true, maxlength: 160 },
    serviceDuration: { type: String, trim: true, maxlength: 40 },

    // customer (referenced + snapshotted)
    customerId: { type: String, default: null, index: true },
    customer: {
      type: new Schema(
        {
          name: { type: String, required: true, trim: true, maxlength: 120 },
          email: { type: String, required: true, trim: true, lowercase: true, maxlength: 180 },
          phone: { type: String, trim: true, maxlength: 30 },
        },
        { _id: false },
      ),
      required: true,
    },

    intake: { type: IntakeSchema, required: true },
    preferredAt: { type: String, default: null },

    amount: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ["pending", "confirmed", "in_progress", "completed", "cancelled", "refunded"],
      default: "pending",
      index: true,
    },
    paymentStatus: { type: String, enum: ["unpaid", "paid", "refunded"], default: "unpaid", index: true },
    paymentMethod: { type: String, enum: ["razorpay", "cod", "manual"], default: "razorpay" },
    payment: { type: PaymentSchema, default: undefined },

    scheduledAt: { type: String, default: null },
    adminNotes: { type: String, trim: true, maxlength: 4000 },

    activity: { type: [ActivitySchema], default: [] },
    placedAt: { type: String, required: true },

    // ── Soft delete ──
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  {
    collection: "bookings",
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

BookingSchema.index(
  { bookingNumber: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
BookingSchema.index({ isDeleted: 1, status: 1, placedAt: -1 });
BookingSchema.index({ isDeleted: 1, customerId: 1, placedAt: -1 });
BookingSchema.index({ isDeleted: 1, serviceId: 1 });

export type BookingDoc = InferSchemaType<typeof BookingSchema> & { _id: Types.ObjectId };

export const BookingModel: Model<BookingDoc> =
  (models.Booking as Model<BookingDoc>) ?? model<BookingDoc>("Booking", BookingSchema);
