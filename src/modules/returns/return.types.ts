/**
 * Returns (RMA) domain — types. A return references an order and the specific
 * line items being returned. It moves through a lifecycle and, on refund,
 * restocks the items and records the refunded amount.
 *
 * Lifecycle:
 *   requested → approved → received → refunded
 *                   ↘ rejected
 */

export type ReturnStatus =
  | "requested"
  | "approved"
  | "received"
  | "refunded"
  | "rejected";

export type ReturnReason =
  | "damaged"
  | "not_as_described"
  | "wrong_item"
  | "changed_mind"
  | "quality"
  | "other";

export interface ReturnItem {
  productId: string;
  variantId?: string;
  name: string;
  image?: string;
  qty: number; // quantity being returned
  unitPrice: number;
  lineRefund: number; // qty * unitPrice (suggested refund for this line)
}

export interface ReturnActivity {
  id: string;
  at: string;
  type: "created" | "status" | "note" | "refund";
  message: string;
  actor?: string;
}

export interface ReturnRequest {
  id: string;
  returnNumber: string; // RMA-2026-XXXX
  orderId: string;
  orderNumber: string;
  customer: { name: string; email: string; phone?: string };
  customerId?: string;

  items: ReturnItem[];
  reason: ReturnReason;
  comment?: string;

  status: ReturnStatus;
  /** suggested = sum of line refunds; refundAmount is what was actually paid back */
  suggestedRefund: number;
  refundAmount?: number;
  restock: boolean; // restock items on refund

  activity: ReturnActivity[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateReturnItemInput {
  productId: string;
  variantId?: string;
  qty: number;
}

export interface CreateReturnInput {
  orderId: string;
  items: CreateReturnItemInput[];
  reason: ReturnReason;
  comment?: string;
  restock?: boolean;
}
