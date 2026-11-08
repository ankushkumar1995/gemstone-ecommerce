import "server-only";

/**
 * Poojas — Mongoose models.
 *   poojas          catalog (nested config stored as validated objects)
 *   pandits
 *   pooja_bookings  unique bookingNumber; indexed for the admin queues
 *   pooja_slots     one counter per pooja + slot: atomic capacity
 *   pooja_counters  yearly booking-number sequence
 * Nested objects are validated by zod before they get here, so they use Mixed.
 */

import { Schema, model, models, type Model } from "mongoose";

const Mixed = Schema.Types.Mixed;

const PoojaSchema = new Schema(
  {
    // "pooja" | "havan". Old documents have no value and are read as "pooja".
    type: { type: String, default: "pooja", index: true },
    havan: { type: Mixed, default: null },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: String, required: true, trim: true },
    subtitle: String, deity: String,
    category: { type: String, required: true },
    tags: [String],
    shortDescription: String, description: String,
    benefits: [String], vidhi: [String], includes: [String],
    faqs: { type: Mixed, default: [] },
    coverImage: String, gallery: [String], videoUrl: String,
    location: { type: Mixed, required: true },
    durationMin: Number, panditCount: Number, mantraCount: Number,
    packages: { type: Mixed, default: [] },
    addOns: { type: Mixed, default: [] },
    schedule: { type: Mixed, required: true },
    sankalp: { type: Mixed, required: true },
    policy: { type: Mixed, required: true },
    seo: { type: Mixed, default: {} },
    status: { type: String, required: true, index: true },
    featured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    createdBy: String, updatedBy: String,
  },
  { collection: "poojas", timestamps: true, versionKey: false, minimize: false },
);
PoojaSchema.index({ status: 1, sortOrder: 1 });
PoojaSchema.index({ category: 1 });

const PanditSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true },
    email: String, city: String, languages: [String], poojaIds: [String],
    experienceYears: Number, photo: String, maxPerDay: Number,
    active: { type: Boolean, default: true, index: true },
    notes: String,
  },
  { collection: "pandits", timestamps: true, versionKey: false },
);

const BookingSchema = new Schema(
  {
    bookingNumber: { type: String, required: true, unique: true },
    poojaId: { type: String, required: true, index: true },
    pooja: Mixed, package: Mixed, addOns: Mixed,
    slot: { type: Mixed, required: true },
    slotDate: { type: String, required: true },
    customer: Mixed, members: Mixed, wish: String, address: Mixed,
    pricing: Mixed, payment: Mixed,
    paymentStatus: { type: String, index: true },
    razorpayOrderId: { type: String },
    status: { type: String, required: true },
    panditId: { type: String, default: null },
    panditName: String,
    proof: Mixed, prasad: Mixed,
    prasadStatus: { type: String },
    policy: { type: Mixed, required: true },
    rescheduleCount: Number, source: String, linkedOrderId: { type: String, default: null },
    cancelReason: String, adminNotes: String,
    timeline: Mixed,
    progress: { type: Mixed, default: [] },
    customerPhone: String,
    requestId: { type: String },
    version: { type: Number, required: true, default: 1 },
  },
  { collection: "pooja_bookings", timestamps: true, versionKey: false, minimize: false },
);
BookingSchema.index({ status: 1, slotDate: 1 });
BookingSchema.index({ slotDate: 1, panditId: 1 });
BookingSchema.index({ prasadStatus: 1, status: 1 });
BookingSchema.index({ customerPhone: 1 });
BookingSchema.index({ requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $type: "string" } } });
BookingSchema.index({ razorpayOrderId: 1 }, { unique: true, partialFilterExpression: { razorpayOrderId: { $type: "string" } } });

const SlotSchema = new Schema(
  { key: { type: String, required: true, unique: true }, poojaId: { type: String, required: true, index: true }, booked: { type: Number, required: true, default: 0, min: 0 } },
  { collection: "pooja_slots", versionKey: false },
);

const CategorySchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    icon: String, image: String, description: String,
    seo: { type: Mixed, default: {} },
    visible: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0, index: true },
  },
  { collection: "pooja_categories", timestamps: true, versionKey: false, minimize: false },
);

const CounterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } }, { collection: "pooja_counters", versionKey: false });

type AnyDoc = Record<string, unknown>;
export const PoojaModel: Model<AnyDoc> = (models.Pooja as Model<AnyDoc>) ?? model<AnyDoc>("Pooja", PoojaSchema);
export const PanditModel: Model<AnyDoc> = (models.Pandit as Model<AnyDoc>) ?? model<AnyDoc>("Pandit", PanditSchema);
export const PoojaBookingModel: Model<AnyDoc> = (models.PoojaBooking as Model<AnyDoc>) ?? model<AnyDoc>("PoojaBooking", BookingSchema);
export const PoojaSlotModel: Model<AnyDoc> = (models.PoojaSlot as Model<AnyDoc>) ?? model<AnyDoc>("PoojaSlot", SlotSchema);
export const PoojaCategoryModel: Model<AnyDoc> = (models.PoojaCategory as Model<AnyDoc>) ?? model<AnyDoc>("PoojaCategory", CategorySchema);
export const PoojaCounterModel: Model<AnyDoc> = (models.PoojaCounter as Model<AnyDoc>) ?? model<AnyDoc>("PoojaCounter", CounterSchema);
