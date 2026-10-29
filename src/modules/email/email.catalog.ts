/**
 * Email event catalog + the template renderer.
 *
 * The catalog lists every event the system can email on, with a human label,
 * description and the placeholders available to that event's template — the
 * admin UI shows these so editors know what they can use.
 *
 * `renderTemplate` does a safe {{placeholder}} substitution: unknown tokens are
 * left blank, values are HTML-escaped for the HTML body, and a text body is
 * derived from the HTML when none is provided.
 */

import type { EmailEventKey, EmailEventMeta } from "./email.types";

export const EMAIL_EVENTS: EmailEventMeta[] = [
  {
    event: "order_placed",
    label: "Order placed (customer)",
    description: "Sent to the customer right after they place an order.",
    placeholders: ["customerName", "orderNumber", "orderTotal", "paymentStatus", "paymentMethod", "itemsText", "storeName"],
  },
  {
    event: "admin_new_order",
    label: "New order alert (admin)",
    description: "Internal alert to the store's admin inbox for each new order.",
    placeholders: ["customerName", "customerEmail", "customerPhone", "orderNumber", "orderTotal", "status", "paymentStatus", "itemsText", "storeName"],
  },
  {
    event: "order_shipped",
    label: "Order shipped (customer)",
    description: "Sent when an order is marked shipped.",
    placeholders: ["customerName", "orderNumber", "courier", "trackingNumber", "storeName"],
  },
  {
    event: "order_delivered",
    label: "Order delivered (customer)",
    description: "Sent when an order is marked delivered.",
    placeholders: ["customerName", "orderNumber", "storeName"],
  },
  {
    event: "booking_confirmed",
    label: "Booking confirmed (customer)",
    description: "Sent when a service booking is confirmed / paid.",
    placeholders: ["customerName", "serviceTitle", "bookingNumber", "amount", "paymentStatus", "storeName"],
  },
  {
    event: "booking_scheduled",
    label: "Appointment scheduled (customer)",
    description: "Sent when the admin schedules the appointment time.",
    placeholders: ["customerName", "serviceTitle", "bookingNumber", "scheduledAt", "adminNotes", "storeName"],
  },
  {
    event: "booking_completed",
    label: "Consultation completed (customer)",
    description: "Sent when a booking is marked completed.",
    placeholders: ["customerName", "serviceTitle", "bookingNumber", "adminNotes", "storeName"],
  },
  {
    event: "welcome",
    label: "Welcome / subscribe (customer)",
    description: "Sent when someone subscribes via a popup / newsletter / lead form.",
    placeholders: ["customerName", "email", "couponCode", "storeName"],
  },
];

export function eventMeta(event: EmailEventKey): EmailEventMeta | undefined {
  return EMAIL_EVENTS.find((e) => e.event === event);
}

/** HTML-escape a value for safe interpolation into an HTML body. */
function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Replace {{token}} placeholders. `raw=true` leaves values unescaped (used when
 * a value is itself trusted HTML, e.g. a pre-built items table). Unknown tokens
 * resolve to "".
 */
function substitute(template: string, vars: Record<string, string>, raw: boolean): string {
  return template.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_m, key: string) => {
    const val = vars[key];
    if (val == null) return "";
    return raw ? val : escapeHtml(val);
  });
}

/** Derive a plain-text body from an HTML string (strip tags, collapse space). */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Render a template's subject/html/text with the given variables.
 * `rawKeys` names variables whose value is trusted HTML (not escaped) in the
 * HTML body — e.g. "itemsText" when a sender passes an HTML table.
 */
export function renderTemplate(
  tpl: { subject: string; html: string; text?: string },
  vars: Record<string, string>,
  rawKeys: string[] = [],
): { subject: string; html: string; text: string } {
  // For the HTML body, raw-insert the trusted keys and escape the rest. We do a
  // two-pass: first substitute raw keys unescaped, then the remainder escaped.
  const rawVars: Record<string, string> = {};
  const escVars: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (rawKeys.includes(k)) rawVars[k] = v;
    else escVars[k] = v;
  }
  let html = substitute(tpl.html, rawVars, true);
  html = substitute(html, escVars, false);

  const subject = substitute(tpl.subject, vars, false);
  const text = tpl.text && tpl.text.trim()
    ? substitute(tpl.text, vars, false)
    : htmlToText(html);

  return { subject, html, text };
}
