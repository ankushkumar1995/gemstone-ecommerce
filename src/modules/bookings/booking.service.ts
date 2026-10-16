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
import { getBookingRepository } from "./booking.repository";
import { sendBookingConfirmed, sendBookingScheduled, sendBookingCompleted } from "./booking.emails";
import type { Booking, BookingStatus, BookingPaymentStatus } from "./booking.types";
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

export const bookingService = {
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
  async create(dto: CreateBookingDto): Promise<Result<Booking>> {
    const repo = getBookingRepository();

    // resolve + snapshot the service
    const svcRes = await serviceService.getById(dto.serviceId);
    if (!svcRes.ok) return fail(AppErrors.validation("Selected service not found"));
    const svc = svcRes.value;
    if (svc.status !== "active") return fail(AppErrors.validation("This service isn't available right now"));

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
        customerSnap = { name: cRes.value.name, email: cRes.value.email, phone: cRes.value.phone };
      }
    }
    if (!customerSnap) return fail(AppErrors.validation("Sign in to book a service"));

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
  ): Promise<Result<Booking>> {
    const repo = getBookingRepository();
    const b = await repo.findById(bookingId);
    if (!b) return fail(AppErrors.notFound("Booking not found"));
    if (b.paymentStatus === "paid") return ok(b);

    const patch: Partial<Booking> = {
      paymentStatus: "paid",
      payment: {
        provider: "razorpay",
        razorpayOrderId: refs.razorpayOrderId,
        razorpayPaymentId: refs.razorpayPaymentId,
        razorpaySignature: refs.razorpaySignature,
        paidAt: new Date().toISOString(),
      },
      activity: [logEntry("payment", "Payment captured via Razorpay", "Customer"), ...b.activity].slice(0, 50),
    };
    if (b.status === "pending") {
      patch.status = "confirmed";
      patch.activity = [logEntry("status", "Confirmed after payment"), ...(patch.activity ?? b.activity)].slice(0, 50);
    }
    patch.updatedAt = new Date().toISOString();

    const updated = await repo.update(bookingId, patch);
    if (!updated) return fail(AppErrors.notFound("Booking not found"));
    // Notify the customer their booking is confirmed (fire-and-forget).
    void sendBookingConfirmed(updated).catch(() => {});
    return ok(updated);
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
