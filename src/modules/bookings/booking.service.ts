/**
 * Service Bookings domain — service (business logic).
 *
 * A booking is the paid request for one astrology SERVICE. Unlike orders there
 * is no stock/inventory — the lifecycle is purely about delivery:
 *   pending → confirmed → in_progress → completed  (+ cancelled / refunded)
 *
 * Payment uses the same Razorpay flow as orders: an online booking is created
 * `pending`/`unpaid`, and `markPaid` (after signature verification) flips it to
 * `confirmed`/`paid`. A COD/manual booking can be created already confirmed.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId, newReference } from "@/core/id";
import { serviceService } from "@/modules/services";
import { customerService } from "@/modules/customers";
import { auditService } from "@/modules/audit";
import { createRazorpayRefund } from "@/core/razorpay";
import { isVisibleOn, type Channel } from "@/core/channels";
import { getBookingRepository } from "./booking.repository";
import { sendBookingConfirmed, sendBookingScheduled, sendBookingCompleted } from "./booking.emails";
import type { Booking, BookingStatus, BookingPaymentStatus, RefundDestination } from "./booking.types";
import type { CreateBookingDto } from "./booking.schema";

/** Allowed status transitions — guards against illegal jumps. */
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "completed", "cancelled", "refunded"],
  in_progress: ["completed", "cancelled", "refunded"],
  completed: ["refunded"],
  cancelled: [],
  refunded: [],
};

function logEntry(type: Booking["activity"][number]["type"], message: string, actor = "Admin"): Booking["activity"][number] {
  return { id: newId("bact"), at: new Date().toISOString(), type, message, actor };
}

/**
 * Can the CUSTOMER cancel this service booking now, and what comes back?
 *   unpaid + pending                       → yes, nothing to refund
 *   paid + confirmed, not scheduled yet    → yes, 100 % refund
 *   scheduled / in progress / delivered    → no, the astrologer is already on it: support
 */
export function serviceCancelPolicy(b: Booking): { allowed: boolean; refundAmount: number; refundTo: RefundDestination[]; why: string } {
  const refundTo: RefundDestination[] = [];
  if (b.paymentMethod === "razorpay" && b.payment?.razorpayPaymentId) refundTo.push("source");
  if (b.customerId) refundTo.push("wallet");
  if (b.status === "pending" && b.paymentStatus === "unpaid") return { allowed: true, refundAmount: 0, refundTo: [], why: "" };
  if (b.status === "confirmed" && b.paymentStatus === "paid" && !b.scheduledAt) {
    if (!refundTo.length) return { allowed: false, refundAmount: 0, refundTo, why: "This booking was paid offline. Please contact support to cancel it." };
    return { allowed: true, refundAmount: b.amount, refundTo, why: "" };
  }
  if (b.status === "confirmed" && b.scheduledAt) return { allowed: false, refundAmount: 0, refundTo, why: "Your session is already scheduled with the astrologer. Please contact support to cancel." };
  if (b.status === "in_progress") return { allowed: false, refundAmount: 0, refundTo, why: "The astrologer has started working on this. Please contact support." };
  return { allowed: false, refundAmount: 0, refundTo, why: "" };
}

export const bookingService = {
  /**
   * Customer cancels their own booking (app / website). Re-checks the policy on
   * the server, flips the status atomically (a double tap or the team scheduling
   * it at the same moment cannot both win), then refunds exactly once:
   *   source → Razorpay refund to the card / UPI / bank (5-7 working days)
   *   wallet → AstroUnkle wallet cash, instant (idempotent wallet key)
   * A failed gateway refund leaves a clear note for the team; the booking stays cancelled.
   */
  async customerCancel(customerId: string, bookingNumber: string, refundTo: RefundDestination): Promise<Result<Booking>> {
    const repo = getBookingRepository();
    const b = await repo.findByNumber(bookingNumber);
    if (!b || b.customerId !== customerId) return fail(AppErrors.notFound("Booking not found"));
    if (b.status === "cancelled") return ok(b); // retried tap
    const pol = serviceCancelPolicy(b);
    if (!pol.allowed) return fail(AppErrors.validation(pol.why || "This booking can no longer be cancelled in the app. Please contact support."));
    if (pol.refundAmount > 0 && !pol.refundTo.includes(refundTo)) return fail(AppErrors.validation("Please choose where the refund should go."));

    const now = new Date().toISOString();
    const paid = pol.refundAmount > 0;
    const cancelled = await repo.updateIfUnscheduled(b.id, [b.status], b.paymentStatus, {
      status: "cancelled",
      updatedAt: now,
      activity: [logEntry("status", `Cancelled by the customer${paid ? ` · refund ₹${pol.refundAmount} to ${refundTo === "wallet" ? "wallet" : "original payment method"}` : ""}`, "Customer"), ...b.activity].slice(0, 50),
    });
    if (!cancelled) {
      const fresh = await repo.findById(b.id);
      if (fresh?.status === "cancelled") return ok(fresh);
      return fail(AppErrors.conflict("This booking was just updated by our team. Please refresh and check again."));
    }
    await auditService.record({ action: "status", entity: "order", entityId: b.id, entityLabel: b.bookingNumber, summary: `Customer cancelled ${b.bookingNumber}${paid ? ` (refund ₹${pol.refundAmount} to ${refundTo})` : ""}`, actor: "Customer" }).catch(() => undefined);
    if (!paid) return ok(cancelled);
    return this.refundCancelled(cancelled, refundTo);
  },

  /** Send the money back for a booking the customer just cancelled. Never twice: the refund field is the guard. */
  async refundCancelled(b: Booking, to: RefundDestination): Promise<Result<Booking>> {
    const repo = getBookingRepository();
    if (b.refund?.status === "processed") return ok(b);
    const at = new Date().toISOString();
    let refund: NonNullable<Booking["refund"]>;
    if (to === "wallet") {
      try {
        const { walletService } = await import("@/modules/wallets");
        const r = await walletService.refund(b.customerId ?? "", `bkcancel_${b.id}`, { cashPaise: Math.round(b.amount * 100), promoPaise: 0 }, b.bookingNumber, `Refund for cancelled booking ${b.bookingNumber} (${b.serviceTitle})`, "System");
        if (r.status === "insufficient") throw new Error("wallet refused the credit");
        refund = { amount: b.amount, to, status: "processed", reference: r.txn?.id ?? "", at };
      } catch (e) {
        refund = { amount: b.amount, to, status: "failed", reference: "", at, error: e instanceof Error ? e.message.slice(0, 160) : "wallet error" };
      }
    } else {
      try {
        const rz = await createRazorpayRefund({ paymentId: b.payment?.razorpayPaymentId ?? "", amountInRupees: b.amount, receipt: `cxl_${b.bookingNumber}`, notes: { bookingNumber: b.bookingNumber, reason: "cancelled by customer" } });
        refund = { amount: b.amount, to, status: "processed", reference: rz.id, at };
      } catch (e) {
        refund = { amount: b.amount, to, status: "failed", reference: "", at, error: e instanceof Error ? e.message.slice(0, 160) : "gateway error" };
      }
    }
    const done = refund.status === "processed";
    const updated = await repo.update(b.id, {
      refund,
      ...(done ? { paymentStatus: "refunded" as const } : {}),
      updatedAt: at,
      activity: [logEntry("payment", done
        ? `Refunded ₹${b.amount} to ${to === "wallet" ? "the AstroUnkle wallet" : "the original payment method"} (${refund.reference})`
        : `Refund of ₹${b.amount} FAILED, refund it manually: ${refund.error}`, "System"), ...b.activity].slice(0, 50),
    });
    await auditService.record({ action: "refund", entity: "order", entityId: b.id, entityLabel: b.bookingNumber, summary: done ? `Refunded ₹${b.amount} for ${b.bookingNumber} to ${to}` : `Refund FAILED for ${b.bookingNumber}: refund ₹${b.amount} manually`, actor: "System" }).catch(() => undefined);
    return ok(updated ?? b);
  },

  async list(): Promise<Result<Booking[]>> {
    const repo = getBookingRepository();
    return ok(await repo.findAll());
  },

  async getById(id: string): Promise<Result<Booking>> {
    const repo = getBookingRepository();
    const b = await repo.findById(id);
    if (!b) return fail(AppErrors.notFound("Booking not found"));
    return ok(b);
  },

  async listByCustomer(customerId: string): Promise<Result<Booking[]>> {
    const repo = getBookingRepository();
    return ok(await repo.findByCustomer(customerId));
  },

  /** Lightweight counts for the admin badge / dashboard widget. */
  async counts(): Promise<Result<{ pending: number; active: number; total: number }>> {
    const repo = getBookingRepository();
    const all = await repo.findAll();
    const pending = all.filter((b) => b.status === "pending").length;
    const active = all.filter((b) => ["pending", "confirmed", "in_progress"].includes(b.status)).length;
    return ok({ pending, active, total: all.length });
  },

  async findByRazorpayOrderId(razorpayOrderId: string): Promise<Booking | null> {
    const repo = getBookingRepository();
    return repo.findByRazorpayOrderId(razorpayOrderId);
  },

  /**
   * Create a booking. Resolves + snapshots the service (and its price), and the
   * customer identity. The charged amount is ALWAYS the server-side service
   * price — never trusted from the client.
   */
  async create(dto: CreateBookingDto, opts: { channel?: Channel } = {}): Promise<Result<Booking>> {
    const repo = getBookingRepository();

    // resolve + snapshot the service
    const svcRes = await serviceService.getById(dto.serviceId);
    if (!svcRes.ok) return fail(AppErrors.validation("Selected service not found"));
    const svc = svcRes.value;
    if (svc.status !== "active") return fail(AppErrors.validation("This service isn't available right now"));
    // Customer bookings respect the admin's Website / App switch.
    if (opts.channel && !isVisibleOn(svc.channels, opts.channel)) return fail(AppErrors.validation("This service is not available here right now"));

    const amount = svc.priceFrom ?? 0;
    if (amount <= 0) {
      // A ₹0 "price on request" service can't be charged online — guard it.
      return fail(AppErrors.validation("This service isn't available for online booking yet"));
    }

    // resolve customer snapshot
    let customerSnap = dto.customer;
    if (dto.customerId) {
      const cRes = await customerService.getById(dto.customerId);
      if (cRes.ok) {
        // Phone sign-ups may have no email / name on the account yet: use what
        // they typed in the form for this booking (the account stays as is).
        customerSnap = {
          name: cRes.value.name || dto.customer?.name || dto.intake.fullName,
          email: cRes.value.email || dto.customer?.email || "",
          phone: cRes.value.phone || dto.customer?.phone || dto.intake.phone,
        };
      }
    }
    if (!customerSnap) return fail(AppErrors.validation("Sign in to book a service"));
    if (!customerSnap.email) return fail(AppErrors.validation("Please add your email so we can send the booking confirmation."));

    const now = new Date().toISOString();
    const status = dto.status ?? "pending";

    const booking: Booking = {
      id: newId("bkg"),
      bookingNumber: newReference("BK"),
      serviceId: svc.id,
      serviceSlug: svc.slug,
      serviceTitle: svc.title,
      serviceDuration: svc.duration,
      customerId: dto.customerId,
      customer: customerSnap,
      intake: {
        fullName: dto.intake.fullName.trim(),
        phone: dto.intake.phone.trim(),
        dob: dto.intake.dob?.trim() || undefined,
        birthTime: dto.intake.birthTime?.trim() || undefined,
        birthPlace: dto.intake.birthPlace?.trim() || undefined,
        gender: dto.intake.gender || "",
        maritalStatus: dto.intake.maritalStatus || "",
        message: dto.intake.message?.trim() || undefined,
      },
      preferredAt: dto.preferredAt || undefined,
      amount,
      status,
      paymentStatus: dto.paymentStatus ?? "unpaid",
      paymentMethod: dto.paymentMethod ?? "razorpay",
      activity: [logEntry("created", `Booking placed (${status})`, "Customer")],
      placedAt: now,
      updatedAt: now,
    };

    const created = await repo.create(booking);

    // If created already-confirmed (COD/manual), log it on the customer.
    if (status === "confirmed" && created.customerId) {
      await customerService.addNote(created.customerId, `Booked service: ${created.serviceTitle} (#${created.bookingNumber})`).catch(() => {});
    }

    await auditService.record({
      action: "create",
      entity: "order",
      entityId: created.id,
      entityLabel: created.bookingNumber,
      summary: `Service booking ${created.bookingNumber} — ${created.serviceTitle} (${status})`,
    });
    return ok(created);
  },

  /** Attach the gateway order id to a freshly-created pending booking. */
  async attachRazorpayOrder(bookingId: string, razorpayOrderId: string): Promise<void> {
    const repo = getBookingRepository();
    const b = await repo.findById(bookingId);
    if (!b) return;
    await repo.update(bookingId, {
      payment: { ...(b.payment ?? { provider: "razorpay" }), provider: "razorpay", razorpayOrderId },
    });
  },

  /**
   * Mark an online booking PAID after its signature is verified. Idempotent:
   * already-paid is a no-op (webhook + client callback can race safely). On
   * first success it stores the gateway refs, flips paymentStatus→paid, and
   * transitions pending→confirmed.
   */
  async markPaid(
    bookingId: string,
    refs: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature?: string },
    opts: { amountPaise?: number } = {},
  ): Promise<Result<Booking>> {
    const repo = getBookingRepository();
    const b = await repo.findById(bookingId);
    if (!b) return fail(AppErrors.notFound("Booking not found"));
    if (b.paymentStatus !== "unpaid") return ok(b);
    // Known amount (webhook / gateway lookup) must match what we charged.
    if (opts.amountPaise !== undefined && opts.amountPaise !== Math.round(b.amount * 100)) {
      await auditService.record({ action: "payment", entity: "order", entityId: b.id, entityLabel: b.bookingNumber, summary: `Razorpay ${refs.razorpayPaymentId} paid ₹${opts.amountPaise / 100} but ${b.bookingNumber} costs ₹${b.amount}. Not applied.`, actor: "System" }).catch(() => undefined);
      return fail(AppErrors.conflict("Paid amount does not match the booking"));
    }

    const at = new Date().toISOString();
    const lateAfterCancel = b.status === "cancelled";
    const patch: Partial<Booking> = {
      paymentStatus: "paid",
      payment: {
        provider: "razorpay",
        razorpayOrderId: refs.razorpayOrderId,
        razorpayPaymentId: refs.razorpayPaymentId,
        razorpaySignature: refs.razorpaySignature,
        paidAt: at,
      },
      activity: [logEntry("payment", lateAfterCancel ? "Payment captured via Razorpay AFTER the booking was cancelled" : "Payment captured via Razorpay", "Customer"), ...b.activity].slice(0, 50),
      updatedAt: at,
    };
    if (b.status === "pending") {
      patch.status = "confirmed";
      patch.activity = [logEntry("status", "Confirmed after payment"), ...(patch.activity ?? b.activity)].slice(0, 50);
    }

    // Atomic: only ONE caller (callback, webhook, status poll) gets past here.
    const updated = await repo.markPaidOnce(bookingId, patch);
    if (!updated) {
      const now = await repo.findById(bookingId);
      return now ? ok(now) : fail(AppErrors.notFound("Booking not found"));
    }

    if (lateAfterCancel) {
      // Cancel means cancel: send every rupee back, automatically.
      return this.autoRefundLate(updated, refs.razorpayPaymentId);
    }
    // Notify the customer their booking is confirmed (fire-and-forget), winner only.
    void sendBookingConfirmed(updated).catch(() => {});
    return ok(updated);
  },

  /** Full Razorpay refund for a payment that arrived after the booking was cancelled. */
  async autoRefundLate(b: Booking, razorpayPaymentId: string): Promise<Result<Booking>> {
    const repo = getBookingRepository();
    try {
      const rz = await createRazorpayRefund({ paymentId: razorpayPaymentId, amountInRupees: b.amount, receipt: `late_${b.bookingNumber}`, notes: { bookingNumber: b.bookingNumber, reason: "paid after cancellation" } });
      const r = await repo.update(b.id, {
        paymentStatus: "refunded",
        refund: { amount: b.amount, to: "source", status: "processed", reference: rz.id, at: new Date().toISOString() },
        activity: [logEntry("payment", `Refunded ₹${b.amount} automatically (paid after cancellation, refund ${rz.id})`, "System"), ...b.activity].slice(0, 50),
        updatedAt: new Date().toISOString(),
      });
      await auditService.record({ action: "refund", entity: "order", entityId: b.id, entityLabel: b.bookingNumber, summary: `Auto refund ₹${b.amount} for ${b.bookingNumber} (paid after cancellation)`, actor: "System" }).catch(() => undefined);
      return ok(r ?? b);
    } catch (e) {
      const r = await repo.update(b.id, {
        activity: [logEntry("payment", `Automatic refund FAILED, refund ₹${b.amount} manually: ${e instanceof Error ? e.message.slice(0, 160) : "gateway error"}`, "System"), ...b.activity].slice(0, 50),
        updatedAt: new Date().toISOString(),
      });
      await auditService.record({ action: "refund", entity: "order", entityId: b.id, entityLabel: b.bookingNumber, summary: `Auto refund FAILED for ${b.bookingNumber}: refund ₹${b.amount} manually`, actor: "System" }).catch(() => undefined);
      return ok(r ?? b);
    }
  },

  /**
   * App / website: where does this paid booking stand? Not paid yet → ask
   * Razorpay and settle a captured payment for the exact amount. Own bookings only.
   */
  async onlineStatus(
    customerId: string,
    razorpayOrderId: string,
    lookup: (orderId: string) => Promise<{ id: string; status: string; amount: number; error_description?: string | null }[]>,
  ): Promise<Result<{ state: "paid" | "processing" | "pending" | "failed" | "refunded" | "review"; bookingNumber: string; status: Booking["status"]; amount: number; reason?: string }>> {
    const repo = getBookingRepository();
    let b = await repo.findByRazorpayOrderId(razorpayOrderId);
    if (!b || b.customerId !== customerId) return fail(AppErrors.notFound("Booking not found"));
    const view = (state: "paid" | "processing" | "pending" | "failed" | "refunded" | "review", bk: Booking, reason?: string) => ({ state, bookingNumber: bk.bookingNumber, status: bk.status, amount: bk.amount, ...(reason ? { reason } : {}) });
    if (b.paymentStatus === "refunded") return ok(view("refunded", b));
    if (b.paymentStatus === "paid") return ok(view(b.status === "cancelled" ? "refunded" : "paid", b));
    let payments;
    try { payments = await lookup(razorpayOrderId); } catch { return ok(view("pending", b)); }
    const captured = payments.find((p) => p.status === "captured");
    if (captured) {
      const s = await this.markPaid(b.id, { razorpayOrderId, razorpayPaymentId: captured.id }, { amountPaise: captured.amount });
      if (!s.ok) return ok(view(/match/i.test(s.error.message) ? "review" : "pending", b));
      b = s.value;
      return ok(view(b.paymentStatus === "refunded" || b.status === "cancelled" ? "refunded" : "paid", b));
    }
    if (payments.some((p) => p.status === "authorized")) return ok(view("processing", b));
    const failed = payments.filter((p) => p.status === "failed");
    if (failed.length && failed.length === payments.length) return ok(view("failed", b, failed[0].error_description || "The payment did not go through."));
    return ok(view(payments.length ? "processing" : "pending", b));
  },

  /** Change booking status with transition validation. */
  async updateStatus(id: string, next: BookingStatus): Promise<Result<Booking>> {
    const repo = getBookingRepository();
    const b = await repo.findById(id);
    if (!b) return fail(AppErrors.notFound("Booking not found"));
    if (b.status === next) return ok(b);
    if (!TRANSITIONS[b.status]?.includes(next)) {
      return fail(AppErrors.validation(`Cannot change status from "${b.status}" to "${next}"`));
    }
    const patch: Partial<Booking> = {
      status: next,
      updatedAt: new Date().toISOString(),
      activity: [logEntry("status", `Status changed from "${b.status}" to "${next}"`), ...b.activity].slice(0, 50),
    };
    if (next === "refunded") patch.paymentStatus = "refunded";
    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Booking not found"));
    await auditService.record({
      action: next === "refunded" ? "refund" : "status",
      entity: "order",
      entityId: updated.id,
      entityLabel: updated.bookingNumber,
      summary: `Booking ${updated.bookingNumber}: ${b.status} → ${next}`,
    });
    // Customer notifications on key transitions (fire-and-forget).
    if (next === "confirmed") void sendBookingConfirmed(updated).catch(() => {});
    if (next === "completed") void sendBookingCompleted(updated).catch(() => {});
    return ok(updated);
  },

  async updatePayment(id: string, paymentStatus: BookingPaymentStatus): Promise<Result<Booking>> {
    const repo = getBookingRepository();
    const b = await repo.findById(id);
    if (!b) return fail(AppErrors.notFound("Booking not found"));
    const updated = await repo.update(id, {
      paymentStatus,
      updatedAt: new Date().toISOString(),
      activity: [logEntry("payment", `Payment marked "${paymentStatus}"`), ...b.activity].slice(0, 50),
    });
    if (!updated) return fail(AppErrors.notFound("Booking not found"));
    return ok(updated);
  },

  /** Set the confirmed appointment time (admin). */
  async schedule(id: string, scheduledAt: string): Promise<Result<Booking>> {
    const repo = getBookingRepository();
    const b = await repo.findById(id);
    if (!b) return fail(AppErrors.notFound("Booking not found"));
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) return fail(AppErrors.validation("Invalid date & time"));
    const updated = await repo.update(id, {
      scheduledAt: when.toISOString(),
      updatedAt: new Date().toISOString(),
      activity: [logEntry("schedule", `Appointment scheduled for ${when.toLocaleString("en-IN")}`), ...b.activity].slice(0, 50),
    });
    if (!updated) return fail(AppErrors.notFound("Booking not found"));
    // Tell the customer their appointment time (fire-and-forget).
    void sendBookingScheduled(updated).catch(() => {});
    return ok(updated);
  },

  /** Save admin notes (internal / delivery details). */
  async setAdminNotes(id: string, adminNotes: string): Promise<Result<Booking>> {
    const repo = getBookingRepository();
    const b = await repo.findById(id);
    if (!b) return fail(AppErrors.notFound("Booking not found"));
    const updated = await repo.update(id, { adminNotes: adminNotes || undefined, updatedAt: new Date().toISOString() });
    if (!updated) return fail(AppErrors.notFound("Booking not found"));
    return ok(updated);
  },

  /** Append a free-text note to the activity timeline. */
  async addNote(id: string, note: string): Promise<Result<Booking>> {
    const repo = getBookingRepository();
    const b = await repo.findById(id);
    if (!b) return fail(AppErrors.notFound("Booking not found"));
    const updated = await repo.update(id, {
      activity: [logEntry("note", note.trim()), ...b.activity].slice(0, 50),
    });
    if (!updated) return fail(AppErrors.notFound("Booking not found"));
    return ok(updated);
  },

  async remove(id: string): Promise<Result<{ id: string }>> {
    const repo = getBookingRepository();
    const removed = await repo.remove(id);
    if (!removed) return fail(AppErrors.notFound("Booking not found"));
    return ok({ id });
  },
};
