/** Shared labels, tones and helpers for the admin Pooja section. */

import type { PoojaBookingStatus, PoojaPaymentStatus, PoojaStatus, PrasadStatus } from "@/modules/poojas/pooja.types";

type Tone = "muted" | "gold" | "green" | "blue" | "rose";

export const POOJA_STATUS: Record<PoojaStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "muted" },
  active: { label: "Live", tone: "green" },
  paused: { label: "Paused", tone: "gold" },
  archived: { label: "Archived", tone: "rose" },
};

export const BOOKING_STATUS: Record<PoojaBookingStatus, { label: string; tone: Tone }> = {
  pending_payment: { label: "Payment pending", tone: "gold" },
  confirmed: { label: "Needs pandit", tone: "blue" },
  assigned: { label: "Pandit assigned", tone: "blue" },
  in_progress: { label: "In progress", tone: "gold" },
  performed: { label: "Performed", tone: "green" },
  completed: { label: "Completed", tone: "green" },
  cancelled: { label: "Cancelled", tone: "rose" },
};

export const PAYMENT_STATUS: Record<PoojaPaymentStatus, { label: string; tone: Tone }> = {
  unpaid: { label: "Unpaid", tone: "gold" },
  paid: { label: "Paid", tone: "green" },
  partially_refunded: { label: "Part refunded", tone: "blue" },
  refunded: { label: "Refunded", tone: "rose" },
};

export const PRASAD_STATUS: Record<PrasadStatus, { label: string; tone: Tone }> = {
  not_required: { label: "No prasad", tone: "muted" },
  pending: { label: "To pack", tone: "gold" },
  packed: { label: "Packed", tone: "blue" },
  shipped: { label: "Shipped", tone: "blue" },
  delivered: { label: "Delivered", tone: "green" },
  returned: { label: "Returned", tone: "rose" },
};

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
export const shortId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
export const fmtSlot = (date: string, time: string) =>
  `${new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}${time && time !== "any" ? ` · ${time}` : ""}`;
export const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
