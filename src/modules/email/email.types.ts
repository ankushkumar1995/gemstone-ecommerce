/**
 * Email module — types. Admin-editable templates, send logs, and the shared
 * contracts the mailer/senders use.
 *
 * A "template" is one editable message for a named EVENT (order placed, order
 * shipped, booking confirmed, …). Each has a subject + HTML body + text body
 * with {{placeholders}} the senders fill from the live order/booking/etc.
 * When no template exists for an event, the sender falls back to its built-in
 * default — so the system works out of the box and customisation is optional.
 */

export type EmailEventKey =
  | "order_placed"
  | "order_shipped"
  | "order_delivered"
  | "admin_new_order"
  | "booking_confirmed"
  | "booking_scheduled"
  | "booking_completed"
  | "welcome"; // newsletter / popup / lead capture

export interface EmailTemplate {
  id: string;
  event: EmailEventKey;
  /** admin-facing name */
  name: string;
  /** whether this template overrides the built-in default */
  enabled: boolean;
  subject: string;
  /** HTML body (may contain {{placeholders}}) */
  html: string;
  /** optional plain-text body; when blank it's derived from html */
  text?: string;
  updatedAt: string;
}

export interface CreateEmailTemplateInput {
  event: EmailEventKey;
  name: string;
  enabled?: boolean;
  subject: string;
  html: string;
  text?: string;
}

export type EmailLogStatus = "delivered" | "failed" | "logged";

/** One recorded send (what, to whom, via which provider, outcome). */
export interface EmailLog {
  id: string;
  event: EmailEventKey | "test" | "other";
  to: string;
  subject: string;
  status: EmailLogStatus;
  provider?: string; // which provider delivered it (if any)
  error?: string; // failure reason
  attempts: { provider: string; delivered: boolean; skipped?: string; error?: string }[];
  createdAt: string;
}

/** Metadata for each event (labels + the placeholders it supports). */
export interface EmailEventMeta {
  event: EmailEventKey;
  label: string;
  description: string;
  placeholders: string[];
}
