import "server-only";

/**
 * Pooja bookings — the admin operations service.
 *
 * Every action re-reads the booking, checks the status machine, then writes
 * with a version guard (a second admin acting on a stale screen gets a clear
 * "reload" error instead of overwriting). Seat changes follow
 * "reserve new → save → release old"; a failed save gives the new seat back.
 *
 * Refunds are two-phase so money can never be returned twice:
 *   1. record a PENDING refund and add it to `refunded` (version-guarded)
 *   2. call Razorpay (receipt = refund id, idempotent there too) or accept
 *      the manual reference
 *   3. mark it processed, or failed and give the amount back
 * A retried request with the same requestId returns the booking unchanged.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors, type AppError } from "@/core/errors";
import { newId } from "@/core/id";
import { isVisibleOn, type Channel } from "@/core/channels";
import { auditService } from "@/modules/audit";
import { createRazorpayRefund, razorpayConfigured } from "@/core/razorpay";
import { getPoojaRepository } from "./pooja.repository";
import { EDITABLE, TRANSITIONS, buildSlots, findSlot, istToday, policyRefund, slotInstant } from "./pooja.rules";
import type { AdminBookingInput, BookingAction, WebBookingInput } from "./pooja.schema";
import type { BookingFilter, BookingRefund, Pooja, PoojaBooking, PoojaBookingStatus, PrasadStatus, ProgressEntry, SankalpMember, TimelineEntry } from "./pooja.types";
import type { Actor } from "./pooja.service";

const RELOAD = "This booking was changed by someone else. Reload and try again.";
/** Pay-online bookings hold the seat this long before they are released. */
export const ONLINE_HOLD_MS = 15 * 60_000;
/** cancelReason written by the hold sweep (lets a late payment revive the booking). */
export const HOLD_EXPIRED_REASON = "Payment not completed within 15 minutes";
const entry = (type: TimelineEntry["type"], message: string, actor: string): TimelineEntry => ({ id: newId("tl"), at: new Date().toISOString(), type, message, actor });
const STATUS_LABEL: Record<PoojaBookingStatus, string> = { pending_payment: "Payment pending", confirmed: "Confirmed", assigned: "Pandit assigned", in_progress: "In progress", performed: "Performed", completed: "Completed", cancelled: "Cancelled" };

const PRASAD_FLOW: Record<PrasadStatus, PrasadStatus[]> = {
  not_required: [],
  pending: ["packed", "shipped"],
  packed: ["pending", "shipped"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  returned: ["shipped", "pending"],
};

/** Fill and check sankalp members against the pooja's form rules. */
function checkSankalp(p: Pooja | null, maxMembers: number, members: SankalpMember[], wish: string): Result<{ members: SankalpMember[]; wish: string }> {
  if (members.length > maxMembers) return fail(AppErrors.validation(`This package allows ${maxMembers} name${maxMembers > 1 ? "s" : ""}`));
  const cfg = p?.sankalp;
  const clean = members.map((m) => ({ ...m, gotra: m.gotra.trim() || (cfg?.requireGotra ? cfg.defaultGotra || "Kashyap" : "") }));
  if (cfg?.requireDob && clean.some((m) => !m.dob)) return fail(AppErrors.validation("Date of birth is required for every name"));
  if (cfg?.requireBirthPlace && clean.some((m) => !m.birthPlace.trim())) return fail(AppErrors.validation("Birth place is required for every name"));
  const w = wish.trim();
  if (cfg?.requireWish && w.length < 3) return fail(AppErrors.validation("Write the sankalp (wish) for this pooja"));
  if (cfg && w.length > cfg.wishMaxLength) return fail(AppErrors.validation(`Sankalp can be at most ${cfg.wishMaxLength} characters`));
  return ok({ members: clean, wish: w });
}

async function save(b: PoojaBooking, patch: Partial<PoojaBooking>, e: TimelineEntry | null): Promise<Result<PoojaBooking>> {
  const repo = getPoojaRepository();
  const res = await repo.updateBooking(b.id, { ...patch, ...(e ? { timeline: [e, ...(patch.timeline ?? b.timeline)].slice(0, 200) } : {}) }, b.version);
  if (res === "conflict") return fail(AppErrors.conflict(RELOAD));
  if (!res) return fail(AppErrors.notFound("Booking not found"));
  return ok(res);
}

const audit = (b: PoojaBooking, action: "create" | "update" | "status" | "refund" | "payment", summary: string, actor: Actor) =>
  auditService.record({ action, entity: "pooja", entityId: b.id, entityLabel: b.bookingNumber, summary, actor: actor.name });

/** Finish a pending refund (phase 3). Re-reads and retries on version races. */
async function settleRefund(id: string, refundId: string, result: { ok: true; reference: string } | { ok: false; error: string }, actor: Actor): Promise<Result<PoojaBooking>> {
  const repo = getPoojaRepository();
  for (let attempt = 0; attempt < 5; attempt++) {
    const b = await repo.getBooking(id);
    if (!b) return fail(AppErrors.notFound("Booking not found"));
    const r = b.payment.refunds.find((x) => x.id === refundId);
    if (!r || r.status !== "pending") return ok(b);
    const refunds = b.payment.refunds.map((x) => (x.id === refundId ? { ...x, ...(result.ok ? { status: "processed" as const, reference: result.reference || x.reference } : { status: "failed" as const, error: result.error }) } : x));
    const refunded = result.ok ? b.payment.refunded : Math.max(0, b.payment.refunded - r.amount);
    const status = refunded <= 0 ? "paid" : refunded >= b.pricing.total ? "refunded" : "partially_refunded";
    const res = await repo.updateBooking(id, {
      payment: { ...b.payment, refunds, refunded, status },
      timeline: [entry("refund", result.ok ? `Refund of ₹${r.amount} processed${result.reference ? ` (ref ${result.reference})` : ""}` : `Refund of ₹${r.amount} failed: ${result.error}`, actor.name), ...b.timeline].slice(0, 200),
    }, b.version);
    if (res === "conflict") continue;
    if (!res) return fail(AppErrors.notFound("Booking not found"));
    await audit(res, "refund", result.ok ? `Refunded ₹${r.amount}: ${r.reason}` : `Refund ₹${r.amount} failed: ${result.error}`, actor);
    return ok(res);
  }
  return fail(AppErrors.conflict(RELOAD));
}

/** Phases 2 + 3 for a refund already recorded as pending. */
export async function executeRefund(b: PoojaBooking, r: BookingRefund, actor: Actor): Promise<Result<PoojaBooking>> {
  if (r.method === "manual") return settleRefund(b.id, r.id, { ok: true, reference: r.reference }, actor);
  if (r.method === "wallet") {
    // Wallet credit is idempotent on the refund id: a retry never credits twice.
    try {
      const { walletService } = await import("@/modules/wallets");
      const w = await walletService.refund(b.customer.customerId ?? "", `pjrefund_${r.id}`, { cashPaise: Math.round(r.amount * 100), promoPaise: 0 }, b.bookingNumber, `Refund for ${b.pooja.title} (${b.bookingNumber})`, actor.name);
      if (w.status === "insufficient") throw new Error("wallet refused the credit");
      return settleRefund(b.id, r.id, { ok: true, reference: w.txn?.id ? `wallet ${w.txn.id}` : "wallet" }, actor);
    } catch (e) {
      const settled = await settleRefund(b.id, r.id, { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "Wallet credit failed" }, actor);
      return settled.ok ? fail(AppErrors.internal("The wallet credit failed. Nothing was refunded; see the timeline.")) : settled;
    }
  }
  try {
    const rz = await createRazorpayRefund({ paymentId: b.payment.razorpayPaymentId ?? "", amountInRupees: r.amount, receipt: r.id, notes: { bookingNumber: b.bookingNumber } });
    return settleRefund(b.id, r.id, { ok: true, reference: rz.id }, actor);
  } catch (e) {
    const settled = await settleRefund(b.id, r.id, { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "Refund failed" }, actor);
    return settled.ok ? fail(AppErrors.internal("The gateway refused the refund. Nothing was refunded; see the timeline.")) : settled;
  }
}

function refundGuard(b: PoojaBooking, amount: number, method: BookingRefund["method"], reference: string): AppError | null {
  if (b.payment.status === "unpaid") return AppErrors.validation("This booking is not paid, so there is nothing to refund");
  const refundable = b.pricing.total - b.payment.refunded;
  if (amount > refundable) return AppErrors.validation(`At most ₹${refundable} can still be refunded`);
  if (method === "razorpay") {
    if (b.payment.method !== "razorpay" || !b.payment.razorpayPaymentId) return AppErrors.validation("This booking was not paid online. Use a manual refund with the reference.");
    if (!razorpayConfigured()) return AppErrors.validation("Online refunds are not available right now. Use a manual refund.");
  }
  if (method === "manual" && reference.trim().length < 3) return AppErrors.validation("Add the bank or UPI reference for a manual refund");
  if (method === "wallet" && !b.customer.customerId) return AppErrors.validation("This booking is not linked to a customer account, so it cannot be refunded to a wallet.");
  return null;
}

/* ---------------- customer self-service (app / website) ---------------- */

export type RefundTo = "source" | "wallet";
const CUSTOMER: Actor = { name: "Customer" } as Actor;

/**
 * Can the customer cancel now, and how much comes back? Uses the refund tiers
 * snapshotted on the booking (the admin's policy at booking time).
 */
export function customerCancelPolicy(b: PoojaBooking, now = Date.now()): { allowed: boolean; refundAmount: number; refundPct: number; refundTo: RefundTo[]; why: string } {
  const refundTo: RefundTo[] = [];
  if (b.payment.method === "razorpay" && b.payment.razorpayPaymentId) refundTo.push("source");
  if (b.customer.customerId) refundTo.push("wallet");
  if (b.status === "pending_payment" && b.payment.status === "unpaid") return { allowed: true, refundAmount: 0, refundPct: 0, refundTo: [], why: "" };
  if (b.status !== "confirmed" && b.status !== "assigned") {
    const why = b.status === "in_progress" ? `The ${b.pooja.type === "havan" ? "havan" : "pooja"} has already started, so it cannot be cancelled.` : "";
    return { allowed: false, refundAmount: 0, refundPct: 0, refundTo, why };
  }
  const refundable = b.payment.status === "unpaid" ? 0 : b.pricing.total - b.payment.refunded;
  const { pct, amount } = policyRefund(b.policy, slotInstant(b.slot.date, b.slot.time), now, refundable);
  if (slotInstant(b.slot.date, b.slot.time) <= now) return { allowed: false, refundAmount: 0, refundPct: 0, refundTo, why: "The pooja time has passed. Please contact support." };
  if (amount > 0 && !refundTo.length) return { allowed: false, refundAmount: amount, refundPct: pct, refundTo, why: "This booking was paid to our team. Please contact support to cancel it." };
  return { allowed: true, refundAmount: amount, refundPct: pct, refundTo: amount > 0 ? refundTo : [], why: "" };
}

/** Can the customer move it to another date (free reschedule window + limit)? */
export function customerReschedulePolicy(b: PoojaBooking, now = Date.now()): { allowed: boolean; until: string | null; left: number; why: string } {
  const startAt = slotInstant(b.slot.date, b.slot.time);
  const until = new Date(startAt - b.policy.freeRescheduleHours * 3_600_000).toISOString();
  const left = Math.max(0, b.policy.maxReschedules - b.rescheduleCount);
  if (b.status !== "confirmed" && b.status !== "assigned") return { allowed: false, until: null, left, why: "" };
  if (b.policy.freeRescheduleHours <= 0 && b.policy.maxReschedules <= 0) return { allowed: false, until: null, left: 0, why: "This booking cannot be rescheduled." };
  if (left <= 0) return { allowed: false, until, left, why: "You have already changed the date the maximum number of times. Please contact support." };
  if (Date.parse(until) <= now) return { allowed: false, until, left, why: `Date changes close ${b.policy.freeRescheduleHours} hours before the ${b.pooja.type === "havan" ? "havan" : "pooja"}. Please contact support.` };
  return { allowed: true, until, left, why: "" };
}

async function ownBooking(customerId: string, bookingNumber: string): Promise<PoojaBooking | null> {
  const b = await getPoojaRepository().findBookingByNumber(bookingNumber);
  return b && b.customer.customerId === customerId ? b : null;
}

export const poojaBookingService = {
  async list(f: BookingFilter): Promise<Result<PoojaBooking[]>> {
    return ok(await getPoojaRepository().listBookings(f));
  },

  async get(id: string): Promise<Result<PoojaBooking>> {
    const b = await getPoojaRepository().getBooking(id);
    return b ? ok(b) : fail(AppErrors.notFound("Booking not found"));
  },

  /** Work queues for the admin dashboard. */
  async counts(now = Date.now()) {
    const repo = getPoojaRepository();
    const today = istToday(now);
    const open = await repo.listBookings({ status: ["pending_payment", "confirmed", "assigned", "in_progress", "performed"], limit: 1000 });
    // Proof is due after the ritual ends: the slot itself for a pooja, the last day for a multi-day havan.
    const endsAt = (b: PoojaBooking) => slotInstant(b.slot.date, b.slot.time) + (Math.max(1, b.pooja.durationDays ?? 1) - 1) * 86_400_000;
    const proofLate = (b: PoojaBooking) => ["assigned", "in_progress"].includes(b.status) && endsAt(b) + b.policy.proofSlaHours * 3_600_000 < now;
    const prasadLate = (b: PoojaBooking) => ["pending", "packed"].includes(b.prasad.status) && b.status === "performed" && Date.parse(b.proof.uploadedAt ?? b.updatedAt) + b.policy.prasadDispatchDays * 86_400_000 < now;
    return {
      today: open.filter((b) => b.slot.date === today && b.status !== "pending_payment").length,
      unpaid: open.filter((b) => b.status === "pending_payment").length,
      needsPandit: open.filter((b) => b.status === "confirmed").length,
      proofPending: open.filter((b) => b.status === "in_progress" || (b.status === "assigned" && b.slot.date < today)).length,
      proofLate: open.filter(proofLate).length,
      prasadToShip: open.filter((b) => b.status === "performed" && ["pending", "packed", "returned"].includes(b.prasad.status)).length,
      prasadLate: open.filter(prasadLate).length,
      toComplete: open.filter((b) => b.status === "performed").length,
    };
  },

  /**
   * Booking request from the website. Saved as "payment pending"; the team
   * calls to confirm and take payment. Uses the same checks as admin bookings
   * (sankalp rules, add-ons, atomic seat reservation, retry-safe requestId)
   * but never allows overbooking, booking after cutoff, discounts or a slot
   * outside the pooja's booking window.
   */
  /**
   * Customer booking. `online` = the customer pays now with Razorpay: the seat
   * is held for ONLINE_HOLD_MS and released if the payment does not arrive.
   * Without it, this is the original "request, team calls to collect" flow.
   */
  async createFromWeb(input: WebBookingInput, customerId: string | null, channel: Channel = "web", online = false): Promise<Result<PoojaBooking>> {
    return this.createByAdmin(
      { ...input, payment: { method: "manual", paid: false, reference: "" }, discount: 0, allowOverbook: false, ignoreCutoff: false },
      { name: channel === "app" ? "Mobile app" : "Website" },
      { customerId, channel, online },
    );
  },

  /**
   * Phone / walk-in / complimentary booking by an admin. Retry-safe via requestId.
   * Customer bookings (`web` set) must also be shown on the caller's channel;
   * admin bookings ignore channels (the team can book anything by phone).
   */
  async createByAdmin(input: AdminBookingInput, actor: Actor, web?: { customerId: string | null; channel?: Channel; online?: boolean }): Promise<Result<PoojaBooking>> {
    const repo = getPoojaRepository();
    const again = await repo.findBookingByRequest(input.requestId);
    if (again) return ok(again);

    const online = Boolean(web?.online);
    const p = await repo.getPooja(input.poojaId);
    if (!p) return fail(AppErrors.notFound("Pooja not found"));
    if (web && p.status !== "active") return fail(AppErrors.validation("This pooja is not taking bookings right now"));
    if (web && !isVisibleOn(p.channels, web.channel ?? "web")) return fail(AppErrors.validation("This pooja is not available here right now"));
    if (p.status !== "active" && p.status !== "paused") return fail(AppErrors.validation("Only active or paused poojas can be booked"));
    const pkg = p.packages.find((x) => x.id === input.packageId);
    if (!pkg || !pkg.active) return fail(AppErrors.validation("This package is not available"));

    const addOns: PoojaBooking["addOns"] = [];
    for (const sel of input.addOns) {
      const a = p.addOns.find((x) => x.id === sel.id);
      if (!a || !a.active) return fail(AppErrors.validation("An add-on is no longer available"));
      if (sel.qty > a.maxQty) return fail(AppErrors.validation(`${a.name}: at most ${a.maxQty}`));
      if (addOns.some((x) => x.id === a.id)) return fail(AppErrors.validation(`${a.name} is added twice`));
      addOns.push({ id: a.id, name: a.name, kind: a.kind, price: a.price, qty: sel.qty, total: a.price * sel.qty, requiresAddress: a.requiresAddress });
    }
    const needsAddress = addOns.some((a) => a.requiresAddress);
    if (needsAddress && !input.address) return fail(AppErrors.validation("Prasad / product delivery needs a shipping address"));

    const sk = checkSankalp(p, pkg.members, input.members, input.wish);
    if (!sk.ok) return sk;

    const now = Date.now();
    const slot = findSlot(p, input.date, input.time, now, await repo.slotUsage(p.id));
    if (!slot) return fail(AppErrors.validation("This pooja does not happen on that date and time"));
    if (web) {
      if (slot.closed) return fail(AppErrors.validation("Booking for this date has closed. Please pick another date."));
      // Customers may only book inside the pooja's advance window.
      const inWindow = buildSlots(p, now, {}, { from: slot.date, days: 0 }).some((x) => x.key === slot.key);
      if (!inWindow) return fail(AppErrors.validation("This date is not open for booking yet. Please pick another date."));
      if (slot.left <= 0) return fail(AppErrors.conflict("This date is fully booked. Please pick another date."));
    }
    if (slot.closed && !input.ignoreCutoff) return fail(AppErrors.validation("Booking for this slot has closed. Tick 'ignore cutoff' to book anyway."));

    const packagePrice = Math.max(0, pkg.price + slot.priceDelta);
    const addOnsTotal = addOns.reduce((s, a) => s + a.total, 0);
    const subtotal = packagePrice + addOnsTotal;
    const free = input.payment.method === "free";
    const discount = free ? subtotal : input.discount;
    if (discount > subtotal) return fail(AppErrors.validation("Discount cannot be more than the total"));
    const total = subtotal - discount;
    const paid = free || input.payment.paid;
    if (input.payment.method === "manual" && paid && input.payment.reference.trim().length < 3) return fail(AppErrors.validation("Add the payment reference (UPI / cash receipt)"));

    if (!(await repo.reserveSlot(p.id, slot.key, input.allowOverbook ? null : slot.capacity))) {
      return fail(AppErrors.conflict("This slot is full. Pick another date, or tick 'allow overbooking'."));
    }

    const at = new Date(now).toISOString();
    const year = Number(at.slice(0, 4));
    let created: PoojaBooking | "duplicate";
    try {
      const status: PoojaBookingStatus = paid ? "confirmed" : "pending_payment";
      created = await repo.createBooking({
        bookingNumber: await repo.nextBookingNumber(year),
        poojaId: p.id,
        pooja: {
          title: p.title, slug: p.slug, image: p.coverImage, location: [p.location.place, p.location.city].filter(Boolean).join(", "), durationMin: p.durationMin,
          // Snapshot: later edits to the pooja never change what this booking was.
          type: p.type,
          ...(p.type === "havan" ? { durationDays: p.havan.durationDays, mode: p.havan.mode, liveUrl: p.havan.liveUrl } : {}),
        },
        progress: [],
        package: { id: pkg.id, name: pkg.name, kind: pkg.kind, members: pkg.members, price: pkg.price },
        addOns,
        slot: { date: slot.date, time: slot.time, key: slot.key, label: slot.label },
        customer: { customerId: web?.customerId ?? null, name: input.customer.name, email: input.customer.email, phone: input.customer.phone },
        members: sk.value.members, wish: sk.value.wish,
        address: needsAddress ? input.address : null,
        pricing: { packagePrice, slotDelta: slot.priceDelta, addOnsTotal, discount, total },
        payment: { method: free ? "free" : online ? "razorpay" : "manual", status: paid ? "paid" : "unpaid", razorpayOrderId: null, razorpayPaymentId: null, reference: input.payment.reference.trim(), paidAt: paid ? at : null, refunded: 0, refunds: [] },
        holdUntil: online && !paid ? new Date(now + ONLINE_HOLD_MS).toISOString() : null,
        status, panditId: null, panditName: "",
        proof: { videoUrl: "", liveUrl: "", photos: [], note: "", uploadedAt: null, uploadedBy: "" },
        prasad: { status: needsAddress ? "pending" : "not_required", courier: "", trackingNo: "", trackingUrl: "", shippedAt: null, deliveredAt: null, note: "" },
        policy: structuredClone(p.policy),
        rescheduleCount: 0, source: web ? (web.channel === "app" ? "app" : "web") : "admin", linkedOrderId: null, cancelReason: "", adminNotes: "",
        timeline: [web
          ? entry("created", `${online ? "Booked" : "Requested"} ${web.channel === "app" ? "in the mobile app" : "on the website"} for ${slot.date}${slot.time === "any" ? "" : ` ${slot.time}`} ${online ? `(paying online, seat held ${ONLINE_HOLD_MS / 60000} min)` : "(payment pending, call to confirm)"}`, actor.name)
          : entry("created", `Booked by admin for ${slot.date}${slot.time === "any" ? "" : ` ${slot.time}`}${free ? " (complimentary)" : paid ? " (paid offline)" : " (payment pending)"}${input.allowOverbook && slot.left <= 0 ? " · overbooked" : ""}${input.ignoreCutoff && slot.closed ? " · after cutoff" : ""}`, actor.name)],
        version: 1, createdAt: at, updatedAt: at,
      }, input.requestId);
    } catch (e) {
      await repo.releaseSlot(p.id, slot.key);
      throw e;
    }
    if (created === "duplicate") {
      await repo.releaseSlot(p.id, slot.key);
      const existing = await repo.findBookingByRequest(input.requestId);
      return existing ? ok(existing) : fail(AppErrors.conflict(RELOAD));
    }
    await audit(created, "create", `Created ${created.bookingNumber} for ${created.customer.name}: ${p.title} on ${slot.date} (₹${total})`, actor);
    return ok(created);
  },

  /** Every admin action on a booking. */
  async act(id: string, a: BookingAction, actor: Actor): Promise<Result<PoojaBooking>> {
    const repo = getPoojaRepository();
    const b = await repo.getBooking(id);
    if (!b) return fail(AppErrors.notFound("Booking not found"));
    const can = (to: PoojaBookingStatus) => TRANSITIONS[b.status].includes(to);
    const notAllowed = (what: string) => fail<PoojaBooking>(AppErrors.validation(`Cannot ${what} a booking that is "${STATUS_LABEL[b.status]}"`));

    switch (a.action) {
      case "mark_paid": {
        if (b.status !== "pending_payment" || b.payment.status !== "unpaid") return notAllowed("mark paid");
        const r = await save(b, { status: "confirmed", payment: { ...b.payment, method: b.payment.method === "free" ? "free" : "manual", status: "paid", reference: a.reference.trim(), paidAt: new Date().toISOString() } }, entry("payment", `Marked paid (ref ${a.reference.trim()})`, actor.name));
        if (r.ok) await audit(r.value, "payment", `Marked ${b.bookingNumber} paid offline (₹${b.pricing.total}, ref ${a.reference.trim()})`, actor);
        return r;
      }

      case "assign": {
        if (b.status !== "confirmed" && b.status !== "assigned") return notAllowed("assign a pandit to");
        if (b.panditId === a.panditId) return ok(b);
        const pd = await repo.getPandit(a.panditId);
        if (!pd) return fail(AppErrors.notFound("Pandit not found"));
        if (!pd.active) return fail(AppErrors.validation(`${pd.name} is inactive`));
        if (!a.force && pd.poojaIds.length && !pd.poojaIds.includes(b.poojaId)) return fail(AppErrors.validation(`${pd.name} is not set up for this pooja. Assign anyway to override.`, { canForce: true }));
        const load = await repo.panditLoad(pd.id, b.slot.date, b.id);
        if (!a.force && load >= pd.maxPerDay) return fail(AppErrors.validation(`${pd.name} already has ${load} poojas on ${b.slot.date} (limit ${pd.maxPerDay}). Assign anyway to override.`, { canForce: true }));
        const r = await save(b, { status: "assigned", panditId: pd.id, panditName: pd.name }, entry("pandit", `${b.panditName ? `Pandit changed from ${b.panditName} to` : "Assigned to"} ${pd.name}${a.force ? " (override)" : ""}`, actor.name));
        if (r.ok) await audit(r.value, "update", `Assigned ${b.bookingNumber} to ${pd.name}${a.force ? " (override)" : ""}`, actor);
        return r;
      }

      case "unassign": {
        if (b.status !== "assigned") return notAllowed("remove the pandit from");
        return save(b, { status: "confirmed", panditId: null, panditName: "" }, entry("pandit", `Removed pandit ${b.panditName}: ${a.reason}`, actor.name));
      }

      case "start": {
        if (!can("in_progress")) return notAllowed("start");
        const today = istToday(Date.now());
        if (b.slot.date > today) return fail(AppErrors.validation(`This pooja is on ${b.slot.date}. It cannot be started earlier.`));
        return save(b, { status: "in_progress" }, entry("status", "Pooja started", actor.name));
      }

      case "proof": {
        if (b.status === "cancelled" || b.status === "pending_payment") return notAllowed("add proof to");
        const media = a.videoUrl || a.photos.length;
        if (media && !["in_progress", "performed", "completed"].includes(b.status)) return fail(AppErrors.validation("Upload the video and photos once the pooja has started. A live link can be added any time."));
        const proof = { videoUrl: a.videoUrl, liveUrl: a.liveUrl, photos: a.photos, note: a.note, uploadedAt: media ? (b.proof.uploadedAt ?? new Date().toISOString()) : b.proof.uploadedAt, uploadedBy: media ? actor.name : b.proof.uploadedBy };
        const what = [a.liveUrl && a.liveUrl !== b.proof.liveUrl ? "live link" : "", a.videoUrl && a.videoUrl !== b.proof.videoUrl ? "video" : "", a.photos.length !== b.proof.photos.length ? `${a.photos.length} photos` : ""].filter(Boolean).join(", ") || "proof details";
        return save(b, { proof }, entry("proof", `Updated ${what}`, actor.name));
      }

      case "perform": {
        if (!can("performed")) return notAllowed("mark performed");
        if (!b.proof.videoUrl && !b.proof.photos.length) return fail(AppErrors.validation("Upload the pooja video or at least one photo first"));
        const r = await save(b, { status: "performed" }, entry("status", "Pooja performed. Proof shared with the customer.", actor.name));
        if (r.ok) await audit(r.value, "status", `${b.bookingNumber} performed`, actor);
        return r;
      }

      case "complete": {
        if (!can("completed")) return notAllowed("complete");
        if (!["not_required", "delivered"].includes(b.prasad.status)) return fail(AppErrors.validation("Prasad is not delivered yet. Update the prasad status first."));
        return save(b, { status: "completed" }, entry("status", "Booking completed", actor.name));
      }

      case "reopen": {
        if (b.status !== "completed") return notAllowed("reopen");
        return save(b, { status: "performed" }, entry("status", `Reopened: ${a.reason}`, actor.name));
      }

      case "reschedule": {
        if (!EDITABLE.includes(b.status)) return notAllowed("reschedule");
        const p = await repo.getPooja(b.poojaId);
        if (!p) return fail(AppErrors.notFound("Pooja not found"));
        const slot = findSlot(p, a.date, a.time, Date.now(), await repo.slotUsage(p.id));
        if (!slot) return fail(AppErrors.validation("This pooja does not happen on that date and time"));
        if (slot.key === b.slot.key) return fail(AppErrors.validation("Pick a different date or time"));
        if (slot.closed && !a.ignoreCutoff) return fail(AppErrors.validation("Booking for that slot has closed. Tick 'ignore cutoff' to move anyway."));
        if (!(await repo.reserveSlot(p.id, slot.key, a.allowOverbook ? null : slot.capacity))) return fail(AppErrors.conflict("That slot is full. Pick another one, or allow overbooking."));
        const dateChanged = slot.date !== b.slot.date;
        const beyond = b.rescheduleCount >= b.policy.maxReschedules;
        const r = await save(b, {
          slot: { date: slot.date, time: slot.time, key: slot.key, label: slot.label },
          rescheduleCount: b.rescheduleCount + 1,
          ...(dateChanged && b.status === "assigned" ? { status: "confirmed" as const, panditId: null, panditName: "" } : {}),
        }, entry("schedule", `Moved from ${b.slot.date} ${b.slot.time} to ${slot.date} ${slot.time}: ${a.reason}${beyond ? " (beyond policy limit)" : ""}${dateChanged && b.panditName ? `. Pandit ${b.panditName} removed, assign again.` : ""}`, actor.name));
        if (!r.ok) { await repo.releaseSlot(p.id, slot.key); return r; }
        await repo.releaseSlot(p.id, b.slot.key);
        await audit(r.value, "update", `Rescheduled ${b.bookingNumber} to ${slot.date} ${slot.time}: ${a.reason}`, actor);
        return r;
      }

      case "sankalp": {
        if (!EDITABLE.includes(b.status)) return fail(AppErrors.validation("Sankalp details cannot change after the pooja has started"));
        const sk = checkSankalp(await repo.getPooja(b.poojaId), b.package.members, a.members, a.wish);
        if (!sk.ok) return sk;
        return save(b, { members: sk.value.members, wish: sk.value.wish }, entry("edit", "Sankalp details updated", actor.name));
      }

      case "address": {
        if (b.prasad.status === "not_required") return fail(AppErrors.validation("This booking has no delivery"));
        if (["shipped", "delivered"].includes(b.prasad.status)) return fail(AppErrors.validation("Prasad is already shipped. Mark it returned first to change the address."));
        return save(b, { address: a.address }, entry("edit", "Shipping address updated", actor.name));
      }

      case "prasad": {
        if (b.prasad.status === "not_required") return fail(AppErrors.validation("This booking has no prasad delivery"));
        if (b.status === "cancelled") return notAllowed("ship prasad for");
        if (a.status === b.prasad.status) {
          return save(b, { prasad: { ...b.prasad, courier: a.courier, trackingNo: a.trackingNo, trackingUrl: a.trackingUrl, note: a.note } }, entry("prasad", "Prasad details updated", actor.name));
        }
        if (!PRASAD_FLOW[b.prasad.status].includes(a.status)) return fail(AppErrors.validation(`Prasad cannot go from ${b.prasad.status} to ${a.status}`));
        if (a.status === "shipped") {
          if (!["performed", "completed"].includes(b.status)) return fail(AppErrors.validation("Ship prasad after the pooja is performed"));
          if (!b.address) return fail(AppErrors.validation("Add a shipping address first"));
          if (a.courier.trim().length < 2 || a.trackingNo.trim().length < 4) return fail(AppErrors.validation("Courier and tracking number are required to ship"));
        }
        const now = new Date().toISOString();
        const prasad = { ...b.prasad, status: a.status, courier: a.courier, trackingNo: a.trackingNo, trackingUrl: a.trackingUrl, note: a.note,
          shippedAt: a.status === "shipped" ? now : b.prasad.shippedAt, deliveredAt: a.status === "delivered" ? now : a.status === "returned" ? null : b.prasad.deliveredAt };
        // A returned parcel on a completed booking re-opens it so it is not forgotten.
        const reopen = a.status === "returned" && b.status === "completed";
        return save(b, { prasad, ...(reopen ? { status: "performed" as const } : {}) }, entry("prasad", `Prasad ${a.status}${a.status === "shipped" ? ` via ${a.courier} (${a.trackingNo})` : ""}${a.note ? `: ${a.note}` : ""}${reopen ? ". Booking reopened." : ""}`, actor.name));
      }

      case "cancel": {
        // Retried click: already cancelled with this request (with or without a refund).
        if (b.payment.refunds.some((r) => r.requestId === a.requestId) || (b.status === "cancelled" && b.cancelReason === a.reason)) return ok(b);
        if (!can("cancelled")) return notAllowed("cancel");
        if (a.refundAmount > 0) {
          const err = refundGuard(b, a.refundAmount, a.refundMethod, a.reference);
          if (err) return fail(err);
        }
        const refund: BookingRefund | null = a.refundAmount > 0 ? { id: newId("rfd"), requestId: a.requestId, amount: a.refundAmount, reason: `Cancelled: ${a.reason}`, method: a.refundMethod, reference: a.reference.trim(), status: "pending", at: new Date().toISOString(), by: actor.name } : null;
        const r = await save(b, {
          status: "cancelled", cancelReason: a.reason, panditId: null, panditName: "",
          ...(refund ? { payment: { ...b.payment, refunds: [refund, ...b.payment.refunds], refunded: b.payment.refunded + refund.amount } } : {}),
        }, entry("status", `Cancelled: ${a.reason}${refund ? ` · refund ₹${refund.amount} (${refund.method})` : b.payment.status !== "unpaid" ? " · no refund" : ""}`, actor.name));
        if (!r.ok) return r;
        await repo.releaseSlot(b.poojaId, b.slot.key);
        await audit(r.value, "status", `Cancelled ${b.bookingNumber}: ${a.reason}${refund ? ` (refund ₹${refund.amount})` : ""}`, actor);
        return refund ? executeRefund(r.value, refund, actor) : r;
      }

      case "refund": {
        if (b.payment.refunds.some((r) => r.requestId === a.requestId)) return ok(b);
        const err = refundGuard(b, a.amount, a.method, a.reference);
        if (err) return fail(err);
        const refund: BookingRefund = { id: newId("rfd"), requestId: a.requestId, amount: a.amount, reason: a.reason, method: a.method, reference: a.reference.trim(), status: "pending", at: new Date().toISOString(), by: actor.name };
        const r = await save(b, { payment: { ...b.payment, refunds: [refund, ...b.payment.refunds], refunded: b.payment.refunded + a.amount } }, entry("refund", `Refund of ₹${a.amount} started (${a.method}): ${a.reason}`, actor.name));
        if (!r.ok) return r;
        return executeRefund(r.value, refund, actor);
      }

      case "note":
        return save(b, {}, entry("note", a.text.trim(), actor.name));

      case "notes":
        return save(b, { adminNotes: a.adminNotes }, null);

      case "progress": {
        if (b.pooja.type !== "havan") return fail(AppErrors.validation("Daily updates are only for havan / anushthan bookings"));
        if (!["confirmed", "assigned", "in_progress", "performed"].includes(b.status)) return notAllowed("add a daily update to");
        const days = Math.max(1, b.pooja.durationDays ?? 1);
        if (a.day > days) return fail(AppErrors.validation(`This anushthan runs for ${days} day${days > 1 ? "s" : ""}`));
        const item: ProgressEntry = { id: newId("prg"), day: a.day, note: a.note.trim(), jaapDone: a.jaapDone, photos: a.photos.filter(Boolean), videoUrl: a.videoUrl, at: new Date().toISOString(), by: actor.name };
        // One entry per day: posting the same day again replaces it.
        const progress = [...(b.progress ?? []).filter((p) => p.day !== a.day), item].sort((x, y) => x.day - y.day);
        return save(b, { progress }, entry("proof", `Day ${a.day} of ${days} update${a.jaapDone !== null ? ` · ${a.jaapDone.toLocaleString("en-IN")} jaap done` : ""}`, actor.name));
      }
    }
  },

  /**
   * Customer cancels their own booking. The policy is re-checked on the server,
   * the refund follows the booking's refund tiers, and it goes through the same
   * two-phase refund as admin refunds (never twice; `requestId` makes a retried
   * tap a no-op). If the gateway refuses, the booking stays cancelled and the
   * failed refund is visible to the team and the customer.
   */
  async customerCancel(customerId: string, bookingNumber: string, refundTo: RefundTo, requestId: string): Promise<Result<PoojaBooking>> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const b = await ownBooking(customerId, bookingNumber);
      if (!b) return fail(AppErrors.notFound("Booking not found"));
      if (b.status === "cancelled") return ok(b);
      const pol = customerCancelPolicy(b);
      if (!pol.allowed) return fail(AppErrors.validation(pol.why || "This booking can no longer be cancelled in the app. Please contact support."));
      if (pol.refundAmount > 0 && !pol.refundTo.includes(refundTo)) return fail(AppErrors.validation("Please choose where the refund should go."));
      const r = await this.act(b.id, {
        action: "cancel",
        reason: "Cancelled by the customer",
        refundAmount: pol.refundAmount,
        refundMethod: refundTo === "wallet" ? "wallet" : "razorpay",
        reference: "",
        requestId,
      }, CUSTOMER);
      if (r.ok) return r;
      if (r.error.code === "CONFLICT" && /changed by someone/i.test(r.error.message)) continue;
      // Cancelled, but the refund call failed: report the booking as it now stands.
      const now = await ownBooking(customerId, bookingNumber);
      if (now?.status === "cancelled") return ok(now);
      return r;
    }
    return fail(AppErrors.conflict("This booking was just updated by our team. Please refresh and try again."));
  },

  /** Customer moves the booking to another open date inside the free reschedule window. */
  async customerReschedule(customerId: string, bookingNumber: string, date: string, time: string): Promise<Result<PoojaBooking>> {
    const repo = getPoojaRepository();
    const b = await ownBooking(customerId, bookingNumber);
    if (!b) return fail(AppErrors.notFound("Booking not found"));
    const pol = customerReschedulePolicy(b);
    if (!pol.allowed) return fail(AppErrors.validation(pol.why || "This booking cannot be rescheduled in the app."));
    const p = await repo.getPooja(b.poojaId);
    if (!p) return fail(AppErrors.notFound("This pooja is no longer available. Please contact support."));
    const now = Date.now();
    const slot = buildSlots(p, now, await repo.slotUsage(p.id), { from: date, days: 0 }).find((s) => s.date === date && s.time === time);
    if (!slot) return fail(AppErrors.validation("That date is not open for booking. Please pick another date."));
    if (slot.key === b.slot.key) return fail(AppErrors.validation("This is already your booked date."));
    if (slot.closed) return fail(AppErrors.validation("Booking for that date has closed. Please pick another date."));
    if (slot.left <= 0) return fail(AppErrors.conflict("That date is fully booked. Please pick another date."));
    if (slot.priceDelta !== (b.pricing.slotDelta ?? 0)) return fail(AppErrors.validation("That date has a different price. Please pick a date with the same price, or contact support."));
    const r = await this.act(b.id, { action: "reschedule", date: slot.date, time: slot.time, reason: "Date changed by the customer", allowOverbook: false, ignoreCutoff: false }, CUSTOMER);
    if (!r.ok && r.error.code === "CONFLICT" && /changed by someone/i.test(r.error.message)) return fail(AppErrors.conflict("This booking was just updated by our team. Please refresh and try again."));
    return r;
  },

  /** What the cancellation policy suggests refunding right now. */
  refundSuggestion(b: PoojaBooking, now = Date.now()) {
    const refundable = b.payment.status === "unpaid" ? 0 : b.pricing.total - b.payment.refunded;
    return { refundable, ...policyRefund(b.policy, slotInstant(b.slot.date, b.slot.time), now, refundable) };
  },
};
