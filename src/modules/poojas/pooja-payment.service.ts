import "server-only";

/**
 * Pooja / havan ONLINE payment (Razorpay). Website and app share this.
 *
 *   createFromWeb(..., online) → booking "pending_payment", seat held 15 min
 *   attachOrder                → gateway order id stored on the booking
 *   settle (verify / webhook / status / sweep) → exactly once:
 *       pending_payment          → confirmed + paid
 *       cancelled by the sweep   → seat still free? re-reserve + confirm,
 *                                  else full automatic refund
 *       cancelled by anyone else → full automatic refund (cancel means cancel)
 *   sweepExpiredHolds          → asks Razorpay first; only an attempt with no
 *                                payment is cancelled and its seat released
 *
 * Every write uses the booking's version (optimistic lock), so the browser /
 * app callback, the webhook, the status poll and the sweep can all race and
 * the money is still applied exactly once. Amounts are checked against the
 * booking total before anything is marked paid.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import { auditService } from "@/modules/audit";
import { getPoojaRepository } from "./pooja.repository";
import { findSlot } from "./pooja.rules";
import { HOLD_EXPIRED_REASON, executeRefund } from "./pooja-booking.service";
import type { BookingRefund, PoojaBooking, TimelineEntry } from "./pooja.types";

type Lookup = (orderId: string) => Promise<{ id: string; status: string; amount: number; error_description?: string | null }[]>;
export type SettleOutcome = "confirmed" | "already" | "revived" | "refunded" | "mismatch";

const SYSTEM = { name: "System" };
const entry = (type: TimelineEntry["type"], message: string, actor = "Razorpay"): TimelineEntry => ({ id: newId("tl"), at: new Date().toISOString(), type, message, actor });
const paise = (rupees: number) => Math.round(rupees * 100);
const audit = (b: PoojaBooking, summary: string) =>
  auditService.record({ action: "payment", entity: "pooja", entityId: b.id, entityLabel: b.bookingNumber, summary, actor: "System" }).catch(() => undefined);

export const poojaPaymentService = {
  async attachOrder(bookingId: string, razorpayOrderId: string): Promise<Result<PoojaBooking>> {
    const repo = getPoojaRepository();
    for (let i = 0; i < 5; i++) {
      const b = await repo.getBooking(bookingId);
      if (!b) return fail(AppErrors.notFound("Booking not found"));
      if (b.payment.razorpayOrderId) return ok(b);
      const r = await repo.updateBooking(b.id, { payment: { ...b.payment, razorpayOrderId } }, b.version);
      if (r === "conflict") continue;
      return r ? ok(r) : fail(AppErrors.notFound("Booking not found"));
    }
    return fail(AppErrors.conflict("Please try again."));
  },

  /**
   * Apply a successful payment exactly once. `amountPaise` (when known: webhook,
   * gateway lookup) must equal the booking total, otherwise nothing is applied.
   */
  async settle(razorpayOrderId: string, razorpayPaymentId: string, amountPaise?: number): Promise<Result<{ booking: PoojaBooking; outcome: SettleOutcome }>> {
    const repo = getPoojaRepository();
    for (let attempt = 0; attempt < 6; attempt++) {
      const b = await repo.findBookingByRazorpayOrder(razorpayOrderId);
      if (!b) return fail(AppErrors.notFound("Booking not found"));
      if (b.payment.status !== "unpaid") return ok({ booking: b, outcome: "already" });
      if (amountPaise !== undefined && amountPaise !== paise(b.pricing.total)) {
        await audit(b, `Razorpay ${razorpayPaymentId} paid ₹${amountPaise / 100} but ${b.bookingNumber} costs ₹${b.pricing.total}. Not applied.`);
        return ok({ booking: b, outcome: "mismatch" });
      }
      const paidAt = new Date().toISOString();
      const payment: PoojaBooking["payment"] = { ...b.payment, method: "razorpay", status: "paid", razorpayPaymentId, paidAt };
      const msg = `Paid online ₹${b.pricing.total} (${razorpayPaymentId})`;

      if (b.status === "pending_payment") {
        const r = await repo.updateBooking(b.id, { status: "confirmed", holdUntil: null, payment, timeline: [entry("payment", msg), ...b.timeline].slice(0, 200) }, b.version);
        if (r === "conflict") continue;
        if (!r) return fail(AppErrors.notFound("Booking not found"));
        await audit(r, `${r.bookingNumber} paid online ₹${r.pricing.total}`);
        // Remedy commission: this pooja may have been suggested in a chat (the sweep also catches it).
        void import("@/modules/remedies").then((m) => m.remedyService.maybeSweep(5_000)).catch(() => undefined);
        return ok({ booking: r, outcome: "confirmed" });
      }

      if (b.status === "cancelled") {
        // The hold ran out but the money came: keep the booking if the seat is still free.
        if (b.cancelReason === HOLD_EXPIRED_REASON) {
          const p = await repo.getPooja(b.poojaId);
          const slot = p ? findSlot(p, b.slot.date, b.slot.time, Date.now(), await repo.slotUsage(p.id)) : null;
          if (p && slot && !slot.closed && (await repo.reserveSlot(p.id, slot.key, slot.capacity))) {
            const r = await repo.updateBooking(b.id, {
              status: "confirmed", cancelReason: "", holdUntil: null, payment,
              timeline: [entry("payment", `${msg}. Paid after the 15-minute hold ended; the seat was still free, so the booking is confirmed.`), ...b.timeline].slice(0, 200),
            }, b.version);
            if (r === "conflict") { await repo.releaseSlot(p.id, slot.key); continue; }
            if (!r) { await repo.releaseSlot(p.id, slot.key); return fail(AppErrors.notFound("Booking not found")); }
            await audit(r, `${r.bookingNumber} paid after hold expiry, seat re-reserved, confirmed`);
            return ok({ booking: r, outcome: "revived" });
          }
        }
        // Cancelled for real (or no seat left): the customer gets every rupee back.
        const refund: BookingRefund = {
          id: newId("rfd"), requestId: `late:${razorpayPaymentId}`, amount: b.pricing.total,
          reason: b.cancelReason === HOLD_EXPIRED_REASON ? "Paid after the seat hold ended and the date was full" : "Payment arrived after the booking was cancelled",
          method: "razorpay", reference: "", status: "pending", at: paidAt, by: "System",
        };
        const r = await repo.updateBooking(b.id, {
          payment: { ...payment, refunds: [refund, ...b.payment.refunds], refunded: b.payment.refunded + refund.amount },
          timeline: [entry("refund", `${msg} after the booking was cancelled. Full refund of ₹${refund.amount} started automatically.`), ...b.timeline].slice(0, 200),
        }, b.version);
        if (r === "conflict") continue;
        if (!r) return fail(AppErrors.notFound("Booking not found"));
        await audit(r, `${r.bookingNumber}: late payment ₹${refund.amount}, auto refund started`);
        const done = await executeRefund(r, refund, SYSTEM);
        return ok({ booking: done.ok ? done.value : r, outcome: "refunded" });
      }

      // Any other status (e.g. confirmed by the team before the money landed): record the payment.
      const r = await repo.updateBooking(b.id, { holdUntil: null, payment, timeline: [entry("payment", msg), ...b.timeline].slice(0, 200) }, b.version);
      if (r === "conflict") continue;
      if (!r) return fail(AppErrors.notFound("Booking not found"));
      return ok({ booking: r, outcome: "confirmed" });
    }
    return fail(AppErrors.conflict("Busy, please retry."));
  },

  /**
   * Where does this online booking stand? If it is not paid yet, ask Razorpay
   * and settle a captured payment for the exact amount. Customers only see their own.
   */
  async status(customerId: string, razorpayOrderId: string, lookup: Lookup): Promise<Result<PoojaPayStatus>> {
    const repo = getPoojaRepository();
    let b = await repo.findBookingByRazorpayOrder(razorpayOrderId);
    if (!b || b.customer.customerId !== customerId) return fail(AppErrors.notFound("Booking not found"));
    const view = (state: PoojaPayStatus["state"], bk: PoojaBooking, reason?: string): PoojaPayStatus => ({
      state, bookingNumber: bk.bookingNumber, status: bk.status, total: bk.pricing.total, holdUntil: bk.holdUntil ?? null,
      refunded: bk.payment.refunded, ...(reason ? { reason } : {}),
    });
    if (b.payment.status !== "unpaid") return ok(view(b.payment.status === "paid" && b.status !== "cancelled" ? "paid" : "refunded", b));

    let payments;
    try { payments = await lookup(razorpayOrderId); } catch { return ok(view(b.status === "cancelled" ? "expired" : "pending", b)); }
    const captured = payments.find((p) => p.status === "captured");
    if (captured) {
      const s = await this.settle(razorpayOrderId, captured.id, captured.amount);
      if (!s.ok) return ok(view("pending", b));
      b = s.value.booking;
      if (s.value.outcome === "mismatch") return ok(view("review", b));
      if (s.value.outcome === "refunded" || b.status === "cancelled") return ok(view("refunded", b));
      return ok(view("paid", b));
    }
    if (b.status === "cancelled") return ok(view("expired", b));
    if (payments.some((p) => p.status === "authorized")) return ok(view("processing", b));
    const failed = payments.filter((p) => p.status === "failed");
    if (failed.length && failed.length === payments.length) return ok(view("failed", b, failed[0].error_description || "The payment did not go through."));
    return ok(view(payments.length ? "processing" : "pending", b));
  },

  /**
   * Release seats of pay-online bookings whose 15 minutes ran out. Razorpay is
   * asked first: a captured payment is settled instead, an "authorized" one is
   * left alone (the bank already approved it), and if the gateway cannot be
   * reached nothing is cancelled. Safe to run from many places at once.
   */
  async sweepExpiredHolds(lookup: Lookup, now = Date.now()): Promise<{ checked: number; cancelled: number; settled: number }> {
    const repo = getPoojaRepository();
    const due = await repo.listExpiredHolds(new Date(now).toISOString(), 50);
    let cancelled = 0, settled = 0;
    for (const b of due) {
      if (b.payment.razorpayOrderId) {
        let payments;
        try { payments = await lookup(b.payment.razorpayOrderId); } catch { continue; }
        const captured = payments.find((p) => p.status === "captured");
        if (captured) { const s = await this.settle(b.payment.razorpayOrderId, captured.id, captured.amount); if (s.ok) settled++; continue; }
        if (payments.some((p) => p.status === "authorized")) continue;
      }
      const r = await repo.updateBooking(b.id, {
        status: "cancelled", cancelReason: HOLD_EXPIRED_REASON, holdUntil: null,
        timeline: [entry("status", "Cancelled automatically: the online payment was not completed within 15 minutes. Seat released.", "System"), ...b.timeline].slice(0, 200),
      }, b.version);
      if (r && r !== "conflict") { await repo.releaseSlot(b.poojaId, b.slot.key); cancelled++; }
    }
    return { checked: due.length, cancelled, settled };
  },
};

export interface PoojaPayStatus {
  /**
   * paid       confirmed and paid
   * processing bank approved / attempt running, check again shortly
   * pending    no completed attempt yet; seat held until `holdUntil`
   * failed     every attempt failed; customer can try again while held
   * expired    hold ended without payment; seat released
   * refunded   money came after the booking was cancelled; refunded in full
   * review     paid amount did not match; support will sort it out
   */
  state: "paid" | "processing" | "pending" | "failed" | "expired" | "refunded" | "review";
  bookingNumber: string;
  status: PoojaBooking["status"];
  total: number;
  holdUntil: string | null;
  refunded: number;
  reason?: string;
}

/* Throttled sweep for request paths (no cron needed in dev; cron can call it too). */
let lastSweep = 0;
let sweeping: Promise<unknown> | null = null;
export function maybeSweepHolds(lookup: Lookup, everyMs = 60_000): void {
  if (sweeping || Date.now() - lastSweep < everyMs) return;
  lastSweep = Date.now();
  sweeping = poojaPaymentService.sweepExpiredHolds(lookup).catch(() => undefined).finally(() => { sweeping = null; });
}
