/**
 * Orders domain — types. Single source of truth for an Order record.
 *
 * Design notes:
 *  - Order items store a PRODUCT SNAPSHOT (name/image/price at purchase time),
 *    so editing or deleting a product later never mutates historical orders.
 *  - The customer is referenced by id but also snapshotted (name/email/phone),
 *    for the same reason.
 *  - Stock is decremented when an order becomes "confirmed" (Option A) and
 *    restocked on cancel/refund — handled in the service.
 */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentStatus = "unpaid" | "paid" | "refunded";

export type PaymentMethod = "cod" | "card" | "upi" | "netbanking" | "manual" | "razorpay";

/** Gateway payment reference (online payments). */
export interface OrderPayment {
  provider: "razorpay";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  paidAt?: string; // ISO
}

/** Ordered pipeline for the status stepper (terminal states excluded). */
export const ORDER_PIPELINE: OrderStatus[] = [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
];

export interface OrderItem {
  productId: string;
  variantId?: string;
  name: string;
  image?: string;
  sku?: string;
  variantLabel?: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
  /** Priced configurator snapshot (pooja / jaap / wear) chosen for this line. */
  config?: import("@/modules/configurator").PricedConfig;
}

export interface OrderAddress {
  name: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface OrderPricing {
  subtotal: number;
  discount: number;
  couponCode?: string;
  shipping: number;
  tax: number;
  grandTotal: number;
}

export interface OrderFulfillment {
  courier?: string;
  trackingNumber?: string;
  shippedAt?: string;
  deliveredAt?: string;
}

export interface OrderActivity {
  id: string;
  at: string; // ISO
  type: "created" | "status" | "payment" | "fulfillment" | "note";
  message: string;
  actor?: string;
}

export interface Order {
  id: string;
  orderNumber: string; // NK-2026-XXXX

  customerId?: string; // optional → guest order
  customer: {
    name: string;
    email: string;
    phone?: string;
  };

  items: OrderItem[];
  pricing: OrderPricing;

  shippingAddress: OrderAddress;
  billingAddress?: OrderAddress;

  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  payment?: OrderPayment;

  fulfillment: OrderFulfillment;

  notes?: string;
  activity: OrderActivity[];
  placedAt: string; // ISO
  updatedAt: string; // ISO

  /* ---- customer checkout (app + website); absent on older / admin orders ---- */
  /** Client retry key: the same id returns the same order (never a duplicate). */
  requestId?: string;
  channel?: "web" | "app";
  /**
   * Stock was reserved when the order was placed (atomic, never oversold).
   * When true, confirming does not take stock again and cancelling gives it back.
   */
  stockReserved?: boolean;
  /** Pay-online order still unpaid: the reserved stock is held until this time. */
  holdUntil?: string | null;
  cancelReason?: string;
  refund?: OrderRefundInfo | null;
}

export interface OrderRefundInfo {
  amount: number; // rupees
  /** source = original card / UPI / bank; wallet = AstroUnkle wallet (instant). */
  to: "source" | "wallet";
  /** processed = sent; failed = the team must refund by hand. */
  status: "processed" | "failed";
  reference: string;
  at: string;
  error?: string;
}

/** A line item as submitted when creating an order. */
export interface CreateOrderItemInput {
  productId: string;
  variantId?: string;
  qty: number;
  /** Configurator selection (IDs only); server recomputes the price. */
  config?: import("@/modules/configurator").ConfigSelection;
}

/** Fields accepted when creating an order. */
export interface CreateOrderInput {
  customerId?: string;
  customer?: { name: string; email: string; phone?: string };
  items: CreateOrderItemInput[];
  shippingAddress: OrderAddress;
  billingAddress?: OrderAddress;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  couponCode?: string;
  discount?: number;
  shipping?: number;
  taxRate?: number; // percentage e.g. 3 for 3%
  notes?: string;
  status?: OrderStatus;
}
