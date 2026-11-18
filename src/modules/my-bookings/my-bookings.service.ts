import "server-only";

/**
 * "My bookings" for the signed-in customer (mobile app now; the website
 * account can use it too): pooja / havan bookings + service bookings in one
 * list, newest first.
 *
 * Only customer-safe fields leave the server: no admin notes, internal ids,
 * payment gateway ids, refund internals or other people's data. Guest pooja
 * bookings made with the customer's VERIFIED phone are included (that is how
 * a website guest booking shows up after signing in to the app); for those the
 * address is never returned.
 */

import { ok, type Result } from "@/core/result";
import { bookingService, serviceCancelPolicy } from "@/modules/bookings";
import type { Booking as ServiceBooking } from "@/modules/bookings";
import { getPoojaRepository } from "@/modules/poojas/pooja.repository";
import { customerCancelPolicy, customerReschedulePolicy, poojaBookingService } from "@/modules/poojas/pooja-booking.service";
import { slotInstant } from "@/modules/poojas/pooja.rules";
import type { PoojaBooking } from "@/modules/poojas";

export interface MyPoojaBooking {
  kind: "pooja";
  id: string;
  bookingNumber: string;
  title: string;
  slug: string;
  type: "pooja" | "havan";
  image: string | null;
  location: string;
  packageName: string;
  date: string;
  /** "HH:MM" or "any". */
  time: string;
  label: string;
  durationDays: number;
  names: string[];
  addOns: { name: string; qty: number }[];
  total: number;
  status: PoojaBooking["status"];
  paymentStatus: PoojaBooking["payment"]["status"];
  /** "online" = paid / paying with Razorpay; "later" = team collects. */
  paymentMode: "online" | "later";
  /** Pay-online and still unpaid: the seat is held until this time. */
  holdUntil: string | null;
  refunded: number;
  panditName: string | null;
  proof: { videoUrl: string | null; liveUrl: string | null; photos: string[]; note: string } | null;
  prasad: { status: PoojaBooking["prasad"]["status"]; courier: string; trackingNo: string; trackingUrl: string } | null;
  progress: { day: number; note: string; photos: string[]; videoUrl: string | null; at: string }[];
  cancelReason: string | null;
  createdAt: string;
  /** Slot start (ISO, IST-based) for countdowns and "add to calendar". */
  startsAt: string;
  durationMin: number;
  steps: BookingStep[];
  payment: MyPayment;
  actions: { cancel: CancelOption; reschedule: RescheduleOption };
  policy: { freeRescheduleHours: number; refundTiers: { hoursBefore: number; refundPct: number }[] };
}

export interface BookingStep {
  key: string;
  label: string;
  /** done = happened; current = what is happening now; upcoming = later. */
  state: "done" | "current" | "upcoming" | "cancelled";
  at: string | null;
}

export interface MyRefund {
  amount: number;
  /** source = original card / UPI / bank; wallet = AstroUnkle wallet; team = by our team. */
  to: "source" | "wallet" | "team";
  status: "pending" | "processed" | "failed";
  at: string;
}

export interface MyPayment {
  /** online = Razorpay; team = paid to / collected by our team; free = complimentary. */
  mode: "online" | "team" | "free" | "none";
  paidAt: string | null;
  /** Razorpay payment id (the customer's own receipt reference). */
  reference: string | null;
  refunds: MyRefund[];
}

export interface CancelOption {
  allowed: boolean;
  refundAmount: number;
  refundPct: number;
  refundTo: ("source" | "wallet")[];
  why: string;
}

export interface RescheduleOption { allowed: boolean; until: string | null; left: number; why: string }

export interface MyServiceBooking {
  kind: "service";
  id: string;
  bookingNumber: string;
  title: string;
  slug: string;
  duration: string;
  amount: number;
  status: ServiceBooking["status"];
  paymentStatus: ServiceBooking["paymentStatus"];
  preferredAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  /** What the customer filled in (shown back so they can check it). */
  intake: { fullName: string; dob: string; birthTime: string; birthPlace: string; gender: string; maritalStatus: string };
  steps: BookingStep[];
  payment: MyPayment;
  actions: { cancel: CancelOption };
  cancelReason: string | null;
}

export type MyBooking = MyPoojaBooking | MyServiceBooking;

export interface SupportContact { phone: string; whatsapp: string; email: string }

/* ---------------- step builders ---------------- */

const lastAt = (entries: { at: string; type: string; message: string }[], type: string, re?: RegExp) =>
  entries.find((e) => e.type === type && (!re || re.test(e.message)))?.at ?? null;

function poojaSteps(b: PoojaBooking): BookingStep[] {
  const t = b.timeline ?? []; // newest first
  const noun = b.pooja.type === "havan" ? "Havan" : "Pooja";
  const order: PoojaBooking["status"][] = ["pending_payment", "confirmed", "assigned", "in_progress", "performed", "completed"];
  const reached = order.indexOf(b.status);
  const needsPrasad = b.prasad && b.prasad.status !== "not_required";
  const raw: { key: string; label: string; at: string | null; idx: number; doneIf?: boolean }[] = [
    { key: "booked", label: "Booked", at: b.createdAt, idx: 0 },
    { key: "paid", label: b.payment.method === "free" ? "Confirmed" : "Payment received", at: b.payment.paidAt ?? null, idx: 1 },
    { key: "pandit", label: "Pandit assigned", at: b.panditName ? lastAt(t, "pandit") : null, idx: 2 },
    { key: "started", label: `${noun} started`, at: lastAt(t, "status", /started/i), idx: 3 },
    { key: "performed", label: `${noun} performed`, at: b.proof?.uploadedAt ?? lastAt(t, "status", /performed/i), idx: 4 },
    ...(needsPrasad ? [{ key: "prasad", label: "Prasad delivered", at: b.prasad.deliveredAt ?? null, idx: 4, doneIf: b.prasad.status === "delivered" }] : []),
    { key: "completed", label: "Completed", at: lastAt(t, "status", /completed/i), idx: 5 },
  ];
  if (b.status === "cancelled") {
    const kept = raw.filter((s) => s.at && s.key !== "completed").map<BookingStep>((s) => ({ key: s.key, label: s.label, state: "done", at: s.at }));
    return [...kept, { key: "cancelled", label: "Cancelled", state: "cancelled", at: lastAt(t, "status", /cancel/i) ?? b.updatedAt }];
  }
  let currentSet = false;
  return raw.map((s) => {
    // Status order index: pending_payment 0 (booked) … completed 5.
    const done = s.doneIf ?? reached >= s.idx;
    if (done) return { key: s.key, label: s.label, state: "done", at: s.at };
    if (!currentSet) { currentSet = true; return { key: s.key, label: s.label, state: "current", at: null }; }
    return { key: s.key, label: s.label, state: "upcoming", at: null };
  });
}

function serviceSteps(b: ServiceBooking): BookingStep[] {
  const a = b.activity ?? [];
  const order: ServiceBooking["status"][] = ["pending", "confirmed", "in_progress", "completed"];
  const reached = order.indexOf(b.status);
  const raw = [
    { key: "booked", label: "Booked", at: b.placedAt, done: true },
    { key: "paid", label: "Payment received", at: b.payment?.paidAt ?? null, done: b.paymentStatus !== "unpaid" || reached >= 1 },
    { key: "scheduled", label: "Session scheduled", at: b.scheduledAt ? lastAt(a, "schedule") : null, done: Boolean(b.scheduledAt) || reached >= 2 },
    { key: "in_progress", label: "Astrologer working on it", at: lastAt(a, "status", /to "in_progress"/), done: reached >= 2 },
    { key: "completed", label: "Delivered", at: lastAt(a, "status", /to "completed"/), done: reached >= 3 },
  ];
  if (b.status === "cancelled" || b.status === "refunded") {
    const kept = raw.filter((s) => s.done && s.at && s.key !== "completed").map<BookingStep>((s) => ({ key: s.key, label: s.label, state: "done", at: s.at }));
    return [...kept, { key: "cancelled", label: b.status === "refunded" ? "Refunded" : "Cancelled", state: "cancelled", at: lastAt(a, "status", /cancel|refund/i) ?? b.updatedAt }];
  }
  let currentSet = false;
  return raw.map((s) => {
    if (s.done) return { key: s.key, label: s.label, state: "done", at: s.at };
    if (!currentSet) { currentSet = true; return { key: s.key, label: s.label, state: "current", at: null }; }
    return { key: s.key, label: s.label, state: "upcoming", at: null };
  });
}

function poojaPayment(b: PoojaBooking): MyPayment {
  const mode: MyPayment["mode"] = b.payment.method === "free" ? "free" : b.payment.status === "unpaid" ? "none" : b.payment.method === "razorpay" ? "online" : "team";
  return {
    mode,
    paidAt: b.payment.paidAt ?? null,
    reference: b.payment.method === "razorpay" ? b.payment.razorpayPaymentId ?? null : null,
    refunds: (b.payment.refunds ?? []).map((r) => ({ amount: r.amount, to: r.method === "wallet" ? "wallet" : r.method === "razorpay" ? "source" : "team", status: r.status, at: r.at })),
  };
}

function servicePayment(b: ServiceBooking): MyPayment {
  const mode: MyPayment["mode"] = b.paymentStatus === "unpaid" && !b.refund ? "none" : b.paymentMethod === "razorpay" ? "online" : "team";
  const refunds: MyRefund[] = b.refund ? [{ amount: b.refund.amount, to: b.refund.to, status: b.refund.status, at: b.refund.at }] : [];
  // Old refunds made by the team (status "refunded" without a record).
  if (!refunds.length && b.paymentStatus === "refunded") refunds.push({ amount: b.amount, to: "team", status: "processed", at: b.updatedAt });
  return { mode, paidAt: b.payment?.paidAt ?? null, reference: b.payment?.razorpayPaymentId ?? null, refunds };
}

const GUEST_WHY = "This booking was made without signing in. Please contact support to change it.";

function poojaView(b: PoojaBooking, now = Date.now(), owner = true): MyPoojaBooking {
  const hasProof = Boolean(b.proof?.videoUrl || b.proof?.liveUrl || b.proof?.photos?.length || b.pooja.liveUrl);
  return {
    kind: "pooja",
    id: b.id,
    bookingNumber: b.bookingNumber,
    title: b.pooja.title,
    slug: b.pooja.slug,
    type: b.pooja.type === "havan" ? "havan" : "pooja",
    image: b.pooja.image || null,
    location: b.pooja.location || "",
    packageName: b.package.name,
    date: b.slot.date,
    time: b.slot.time,
    label: b.slot.label || "",
    durationDays: b.pooja.durationDays ?? 1,
    names: (b.members ?? []).map((m) => m.name).filter(Boolean),
    addOns: (b.addOns ?? []).map((a) => ({ name: a.name, qty: a.qty })),
    total: b.pricing.total,
    status: b.status,
    paymentStatus: b.payment.status,
    paymentMode: b.payment.method === "razorpay" ? "online" : "later",
    holdUntil: b.status === "pending_payment" ? b.holdUntil ?? null : null,
    refunded: b.payment.refunded ?? 0,
    // Shown only once the team has actually assigned someone.
    panditName: b.panditName || null,
    proof: hasProof
      ? { videoUrl: b.proof?.videoUrl || null, liveUrl: b.proof?.liveUrl || b.pooja.liveUrl || null, photos: b.proof?.photos ?? [], note: b.proof?.note ?? "" }
      : null,
    prasad: b.prasad && b.prasad.status !== "not_required"
      ? { status: b.prasad.status, courier: b.prasad.courier ?? "", trackingNo: b.prasad.trackingNo ?? "", trackingUrl: b.prasad.trackingUrl ?? "" }
      : null,
    progress: (b.progress ?? []).map((p) => ({ day: p.day, note: p.note, photos: p.photos ?? [], videoUrl: p.videoUrl || null, at: p.at })),
    cancelReason: b.status === "cancelled" ? b.cancelReason || null : null,
    createdAt: b.createdAt,
    startsAt: new Date(slotInstant(b.slot.date, b.slot.time)).toISOString(),
    durationMin: b.pooja.durationMin ?? 0,
    steps: poojaSteps(b),
    payment: poojaPayment(b),
    // Guest bookings matched by phone are shown, but only the account that booked can change them.
    actions: owner
      ? { cancel: customerCancelPolicy(b, now), reschedule: customerReschedulePolicy(b, now) }
      : { cancel: { allowed: false, refundAmount: 0, refundPct: 0, refundTo: [], why: GUEST_WHY }, reschedule: { allowed: false, until: null, left: 0, why: GUEST_WHY } },
    policy: { freeRescheduleHours: b.policy?.freeRescheduleHours ?? 0, refundTiers: [...(b.policy?.refundTiers ?? [])].sort((x, y) => y.hoursBefore - x.hoursBefore) },
  };
}

function serviceView(b: ServiceBooking): MyServiceBooking {
  return {
    kind: "service",
    id: b.id,
    bookingNumber: b.bookingNumber,
    title: b.serviceTitle,
    slug: b.serviceSlug,
    duration: b.serviceDuration ?? "",
    amount: b.amount,
    status: b.status,
    paymentStatus: b.paymentStatus,
    preferredAt: b.preferredAt ?? null,
    scheduledAt: b.scheduledAt ?? null,
    createdAt: b.placedAt,
    intake: {
      fullName: b.intake.fullName ?? "", dob: b.intake.dob ?? "", birthTime: b.intake.birthTime ?? "", birthPlace: b.intake.birthPlace ?? "",
      gender: b.intake.gender ?? "", maritalStatus: b.intake.maritalStatus ?? "",
    },
    steps: serviceSteps(b),
    payment: servicePayment(b),
    actions: { cancel: (() => { const p = serviceCancelPolicy(b); return { allowed: p.allowed, refundAmount: p.refundAmount, refundPct: p.refundAmount > 0 ? 100 : 0, refundTo: p.refundAmount > 0 ? p.refundTo : [], why: p.why }; })() },
    cancelReason: b.status === "cancelled" ? "Cancelled" : null,
  };
}

/** "+919876543210" → "9876543210" (only valid Indian mobiles). */
function phone10(e164: string | null | undefined): string | null {
  const d = (e164 ?? "").replace(/\D/g, "");
  const local = d.length === 12 && d.startsWith("91") ? d.slice(2) : d;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

/** Support channels from store settings (what the "Need help" sheet offers). */
async function supportContact(): Promise<SupportContact> {
  const { settingsService } = await import("@/modules/settings");
  const r = await settingsService.get();
  const s = r.ok ? r.value.general : null;
  const digits = (v?: string) => (v ?? "").replace(/[^\d+]/g, "");
  return { phone: digits(s?.supportPhone), whatsapp: digits(s?.whatsappNumber), email: s?.supportEmail ?? "" };
}

async function verifiedPhone(customerId: string): Promise<string | null> {
  const { connectMongoose } = await import("@/core/db/mongoose");
  const { CustomerModel } = await import("@/modules/customers/customer.model");
  await connectMongoose();
  const c = await CustomerModel.findById(customerId).select("phone phoneVerified").lean<{ phone?: string; phoneVerified?: boolean }>();
  return c?.phoneVerified ? phone10(c.phone) : null;
}

export const myBookingsService = {
  async list(customerId: string): Promise<Result<{ bookings: MyBooking[]; support: SupportContact }>> {
    const [phone, services, support] = await Promise.all([
      verifiedPhone(customerId).catch(() => null),
      bookingService.listByCustomer(customerId).catch(() => null),
      supportContact().catch(() => ({ phone: "", whatsapp: "", email: "" })),
    ]);
    const poojas = await getPoojaRepository().listCustomerBookings(customerId, phone, 100);
    const now = Date.now();
    const all: MyBooking[] = [
      ...poojas.map((b) => poojaView(b, now, b.customer.customerId === customerId)),
      ...(services && services.ok ? services.value.map(serviceView) : []),
    ];
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok({ bookings: all, support });
  },

  /** Customer cancels a pooja / havan or service booking; returns the booking as it now stands. */
  async cancel(customerId: string, bookingNumber: string, refundTo: "source" | "wallet", requestId: string): Promise<Result<{ booking: MyBooking }>> {
    const pooja = await getPoojaRepository().findBookingByNumber(bookingNumber);
    if (pooja) {
      const r = await poojaBookingService.customerCancel(customerId, bookingNumber, refundTo, requestId);
      return r.ok ? ok({ booking: poojaView(r.value) }) : r;
    }
    const r = await bookingService.customerCancel(customerId, bookingNumber, refundTo);
    return r.ok ? ok({ booking: serviceView(r.value) }) : r;
  },

  /** Customer moves a pooja / havan booking to another open date. */
  async reschedule(customerId: string, bookingNumber: string, date: string, time: string): Promise<Result<{ booking: MyBooking }>> {
    const r = await poojaBookingService.customerReschedule(customerId, bookingNumber, date, time);
    return r.ok ? ok({ booking: poojaView(r.value) }) : r;
  },
};
