import type { BookingStatus, BookingPaymentStatus } from "@/modules/bookings";

/** StatusPill tone + label per booking status. */
type Tone = "muted" | "gold" | "green" | "blue" | "rose";

export const B_STATUS_META: Record<BookingStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "muted" },
  confirmed: { label: "Confirmed", tone: "blue" },
  in_progress: { label: "In Progress", tone: "gold" },
  completed: { label: "Completed", tone: "green" },
  cancelled: { label: "Cancelled", tone: "rose" },
  refunded: { label: "Refunded", tone: "rose" },
};

export const B_PAYMENT_META: Record<BookingPaymentStatus, { label: string; tone: Tone }> = {
  unpaid: { label: "Unpaid", tone: "muted" },
  paid: { label: "Paid", tone: "green" },
  refunded: { label: "Refunded", tone: "rose" },
};

/** Allowed next statuses from the current one (admin quick actions). */
export const B_NEXT_STATUSES: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "completed", "cancelled", "refunded"],
  in_progress: ["completed", "cancelled", "refunded"],
  completed: ["refunded"],
  cancelled: [],
  refunded: [],
};
