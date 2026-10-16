/**
 * Service Bookings domain — types. A booking is a customer's paid request for
 * an astrology SERVICE (consultation / report), distinct from a product Order.
 *
 * Design notes:
 *   • The service is SNAPSHOTTED (title/price at booking time) so editing or
 *     deleting a service later never mutates historical bookings.
 *   • The customer is referenced by id AND snapshotted (name/email/phone).
 *   • An "intake" captures what the astrologer needs (DOB, birth time/place,
 *     the question). Optional `preferredAt` is a soft appointment preference —
 *     not a hard slot system.
 *   • Payment reuses the same Razorpay pattern as orders (pending → paid).
 */

export type BookingStatus =
  | "pending" // created, awaiting payment (online) or confirmation
  | "confirmed" // paid / accepted — astrologer will deliver
  | "in_progress" // work started (call scheduled / report being prepared)
  | "completed" // delivered
  | "cancelled"
  | "refunded";

export type BookingPaymentStatus = "unpaid" | "paid" | "refunded";
export type BookingPaymentMethod = "razorpay" | "cod" | "manual";

/** Lifecycle stages shown in the admin stepper (terminal states excluded). */
export const BOOKING_PIPELINE: BookingStatus[] = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
];

/** Birth / enquiry details the astrologer needs to deliver the service. */
export interface BookingIntake {
  fullName: string;
  phone: string;
  /** Date of birth (YYYY-MM-DD). */
  dob?: string;
  /** Time of birth (HH:mm) — important for kundli accuracy. */
  birthTime?: string;
  /** Place of birth (city, country). */
  birthPlace?: string;
  gender?: "male" | "female" | "other" | "";
  /** The customer's question / what they want help with. */
  message?: string;
}

/** Gateway payment reference (online payments). */
export interface BookingPayment {
  provider: "razorpay";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  paidAt?: string; // ISO
}

export interface BookingActivity {
  id: string;
  at: string; // ISO
  type: "created" | "status" | "payment" | "note" | "schedule";
  message: string;
  actor?: string; // "Customer" | "Admin"
}

export interface Booking {
  id: string;
  bookingNumber: string; // human ref, e.g. BK-2026-0042

  // service snapshot
  serviceId: string;
  serviceSlug: string;
  serviceTitle: string;
  serviceDuration?: string;

  // customer (referenced + snapshotted)
  customerId?: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };

  intake: BookingIntake;
  /** Optional soft appointment preference (ISO). */
  preferredAt?: string;

  // pricing (single service, so no line items)
  amount: number; // charged amount in rupees

  status: BookingStatus;
  paymentStatus: BookingPaymentStatus;
  paymentMethod: BookingPaymentMethod;
  payment?: BookingPayment;

  /** Admin's scheduled appointment (ISO) once confirmed. */
  scheduledAt?: string;
  /** Admin-only internal notes + the delivery link/notes shown to customer. */
  adminNotes?: string;

  activity: BookingActivity[];
  placedAt: string; // ISO
  updatedAt: string; // ISO
}

/** A line item as submitted when creating a booking from the storefront. */
export interface CreateBookingInput {
  serviceId: string;
  customerId?: string;
  customer?: { name: string; email: string; phone?: string };
  intake: BookingIntake;
  preferredAt?: string;
  paymentMethod?: BookingPaymentMethod;
  paymentStatus?: BookingPaymentStatus;
  status?: BookingStatus;
}
