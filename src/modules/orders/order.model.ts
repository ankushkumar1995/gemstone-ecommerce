import "server-only";

/**
 * Order — Mongoose model (production schema, single source of truth).
 * ─────────────────────────────────────────────────────────────────────
 *  • `_id` is a native ObjectId; the app sees a string `id` via toJSON.
 *  • Order items + customer are SNAPSHOTTED (name/image/price at purchase
 *    time) so editing/deleting a product or customer later never mutates
 *    historical orders.
 *  • `orderNumber` is unique (human-facing reference, e.g. NK-2026-1042).
 *  • Soft delete so references and history stay intact.
 *  • Indexes shaped around real queries: by number, status, customer, date.
 */

import { Schema, model, models, type Model, type InferSchemaType, type Types } from "mongoose";

const ItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    variantId: { type: String },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    image: { type: String, trim: true },
    sku: { type: String, trim: true, maxlength: 80 },
    variantLabel: { type: String, trim: true, maxlength: 120 },
    unitPrice: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const AddressSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 120, default: "" },
    phone: { type: String, trim: true, maxlength: 30 },
    line1: { type: String, trim: true, maxlength: 200, default: "" },
    line2: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 80, default: "" },
    state: { type: String, trim: true, maxlength: 80 },
    postalCode: { type: String, trim: true, maxlength: 20 },
    country: { type: String, trim: true, maxlength: 80, default: "India" },
  },
  { _id: false },
);

const PricingSchema = new Schema(
  {
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, trim: true, maxlength: 60 },
    shipping: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const FulfillmentSchema = new Schema(
  {
    courier: { type: String, trim: true, maxlength: 80 },
    trackingNumber: { type: String, trim: true, maxlength: 120 },
    shippedAt: { type: String },
    deliveredAt: { type: String },
  },
  { _id: false },
);

const ActivitySchema = new Schema(
  {
    id: { type: String, required: true },
    at: { type: String, required: true },
    type: { type: String, enum: ["created", "status", "payment", "fulfillment", "note"], default: "note" },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    actor: { type: String, trim: true, maxlength: 80 },
  },
  { _id: false },
);

const OrderSchema = new Schema(
  {
    orderNumber: {
      type: String,
      required: [true, "orderNumber is required"],
      trim: true,
      maxlength: 40,
    },

    // Referenced by id but also snapshotted (guest orders have no customerId).
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

    items: { type: [ItemSchema], default: [] },
    pricing: { type: PricingSchema, required: true },

    shippingAddress: { type: AddressSchema, required: true },
    billingAddress: { type: AddressSchema, default: undefined },

    status: {
      type: String,
      enum: ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "refunded"],
      default: "pending",
      index: true,
    },
    paymentStatus: { type: String, enum: ["unpaid", "paid", "refunded"], default: "unpaid", index: true },
    paymentMethod: { type: String, enum: ["cod", "card", "upi", "netbanking", "manual", "razorpay"], default: "cod" },

    // Gateway payment reference (Razorpay). Present for online payments only.
    payment: {
      type: new Schema(
        {
          provider: { type: String, enum: ["razorpay"], default: "razorpay" },
          razorpayOrderId: { type: String, trim: true, index: true },
          razorpayPaymentId: { type: String, trim: true },
          razorpaySignature: { type: String, trim: true },
          paidAt: { type: String },
        },
        { _id: false },
      ),
      default: undefined,
    },

    fulfillment: { type: FulfillmentSchema, default: () => ({}) },

    notes: { type: String, trim: true, maxlength: 2000 },
    activity: { type: [ActivitySchema], default: [] },

    placedAt: { type: String, required: true },

    // ── Soft delete ──
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  {
    collection: "orders",
    timestamps: true, // createdAt + updatedAt (updatedAt mirrored into the app `updatedAt` string too)
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

OrderSchema.index(
  { orderNumber: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
OrderSchema.index({ isDeleted: 1, status: 1, placedAt: -1 });
OrderSchema.index({ isDeleted: 1, customerId: 1, placedAt: -1 });
OrderSchema.index({ isDeleted: 1, paymentStatus: 1 });

export type OrderDoc = InferSchemaType<typeof OrderSchema> & { _id: Types.ObjectId };

export const OrderModel: Model<OrderDoc> =
  (models.Order as Model<OrderDoc>) ?? model<OrderDoc>("Order", OrderSchema);
