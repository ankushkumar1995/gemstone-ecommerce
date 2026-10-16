/**
 * Audit domain — types. A panel-wide activity log: a single stream of every
 * meaningful admin action across all modules (who did what, to which entity,
 * when). Powers the Activity page for security & accountability.
 */

export type AuditEntity =
  | "product"
  | "order"
  | "customer"
  | "coupon"
  | "return"
  | "review"
  | "article"
  | "page"
  | "banner"
  | "category"
  | "collection"
  | "settings"
  | "inventory"
  | "service"
  | "user";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "status"
  | "payment"
  | "refund"
  | "stock"
  | "login"
  | "logout";

export interface AuditEntry {
  id: string;
  at: string; // ISO
  actor: string; // admin name/email (demo: "Admin")
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  entityLabel?: string; // human label e.g. order number / product name
  summary: string; // one-line description
}

export interface RecordAuditInput {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  entityLabel?: string;
  summary: string;
  actor?: string;
}
