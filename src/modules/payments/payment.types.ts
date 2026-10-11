/**
 * Payments domain — types. This module does NOT store its own data: a payment
 * "transaction" is derived from orders (charges) and returns (refunds). It
 * gives the admin a single view of money in / money out.
 */

import type { PaymentMethod, PaymentStatus } from "@/modules/orders";

export type TransactionKind = "charge" | "refund";

export interface PaymentTransaction {
  id: string;
  kind: TransactionKind;
  orderId: string;
  orderNumber: string;
  reference?: string; // return number for refunds
  customerName: string;
  customerEmail: string;
  method: PaymentMethod;
  status: PaymentStatus; // charge: order payment status; refund: "refunded"
  amount: number; // positive for charge, positive magnitude for refund
  at: string; // ISO
}

export interface PaymentSummary {
  received: number; // sum of paid charges
  pending: number; // sum of unpaid charges (money still to collect, incl COD)
  refunded: number; // sum of refunds
  net: number; // received - refunded
  codPending: number; // unpaid COD amount specifically
  byMethod: { method: PaymentMethod; amount: number }[]; // received split by method
}

export interface PaymentsReport {
  summary: PaymentSummary;
  transactions: PaymentTransaction[];
}
