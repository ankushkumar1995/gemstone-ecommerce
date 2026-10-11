/** Payments module — public API (derived read-only ledger). */
export { paymentService } from "./payment.service";
export type {
  PaymentTransaction,
  PaymentSummary,
  PaymentsReport,
  TransactionKind,
} from "./payment.types";
