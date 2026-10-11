/**
 * Shared presentation helpers for order status + payment status, so the list,
 * detail and stepper all render identical colours/labels.
 */

import type { OrderStatus, PaymentStatus } from "@/modules/orders";

type Tone = "muted" | "gold" | "green" | "blue" | "rose";

export const STATUS_META: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "gold" },
  confirmed: { label: "Confirmed", tone: "blue" },
  packed: { label: "Packed", tone: "blue" },
  shipped: { label: "Shipped", tone: "blue" },
  delivered: { label: "Delivered", tone: "green" },
  cancelled: { label: "Cancelled", tone: "rose" },
  refunded: { label: "Refunded", tone: "muted" },
};

export const PAYMENT_META: Record<PaymentStatus, { label: string; tone: Tone }> = {
  unpaid: { label: "Unpaid", tone: "rose" },
  paid: { label: "Paid", tone: "green" },
  refunded: { label: "Refunded", tone: "muted" },
};

/** Valid next statuses for the quick status menu (mirrors service rules). */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled", "refunded"],
  packed: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};
