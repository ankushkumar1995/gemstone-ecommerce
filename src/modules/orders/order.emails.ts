import "server-only";

/**
 * Order email templates + senders. Each builds a branded message and sends it
 * through the core multi-provider mailer (which delivers via the first working
 * provider, else logs). Senders never throw — a notification failure must not
 * break the order flow.
 *
 * The admin `adminAlertEmail` (from notification settings) receives new-order
 * alerts; the customer receives confirmation / shipping / delivery updates.
 */

import { emailService } from "@/modules/email";
import type { Order } from "./order.types";

const BRAND = "Astrounkle";

function money2(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function money(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function wrapHtml(title: string, bodyHtml: string): string {
  return `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#241a3b">
    <div style="padding:20px 24px;background:linear-gradient(135deg,#6d4bd8,#2a1d5e);border-radius:16px 16px 0 0">
      <h1 style="margin:0;color:#f4d58d;font-size:20px">${BRAND}</h1>
    </div>
    <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 16px 16px">
      <h2 style="margin:0 0 12px;font-size:18px">${title}</h2>
      ${bodyHtml}
      <p style="margin-top:24px;font-size:12px;color:#999">— Team ${BRAND}</p>
    </div>
  </div>`;
}

/** Build an HTML rows block for the order's line items. */
function itemsHtml(order: Order): string {
  const rows = order.items
    .map(
      (it) =>
        `<tr>
          <td style="padding:6px 0;color:#241a3b">${it.name}${it.variantLabel ? ` — ${it.variantLabel}` : ""} × ${it.qty}</td>
          <td style="padding:6px 0;text-align:right;color:#241a3b">${money(it.lineTotal)}</td>
        </tr>`,
    )
    .join("");
  return `
    <table style="width:100%;font-size:14px;border-collapse:collapse">
      ${rows}
      <tr><td colspan="2" style="border-top:1px solid #eee;padding-top:8px"></td></tr>
      <tr><td style="color:#777">Subtotal</td><td style="text-align:right">${money(order.pricing.subtotal)}</td></tr>
      ${order.pricing.discount ? `<tr><td style="color:#777">Discount</td><td style="text-align:right">- ${money(order.pricing.discount)}</td></tr>` : ""}
      <tr><td style="color:#777">Shipping</td><td style="text-align:right">${order.pricing.shipping ? money(order.pricing.shipping) : "Free"}</td></tr>
      ${order.pricing.tax ? `<tr><td style="color:#777">Tax</td><td style="text-align:right">${money(order.pricing.tax)}</td></tr>` : ""}
      <tr><td style="font-weight:700;padding-top:6px">Total</td><td style="text-align:right;font-weight:700;padding-top:6px">${money(order.pricing.grandTotal)}</td></tr>
    </table>`;
}

function itemsText(order: Order): string {
  const lines = order.items
    .map((it) => `  • ${it.name}${it.variantLabel ? ` (${it.variantLabel})` : ""} × ${it.qty} — ${money(it.lineTotal)}`)
    .join("\n");
  return (
    `${lines}\n` +
    `  Subtotal: ${money(order.pricing.subtotal)}\n` +
    (order.pricing.discount ? `  Discount: -${money(order.pricing.discount)}\n` : "") +
    `  Shipping: ${order.pricing.shipping ? money(order.pricing.shipping) : "Free"}\n` +
    (order.pricing.tax ? `  Tax: ${money(order.pricing.tax)}\n` : "") +
    `  Total: ${money(order.pricing.grandTotal)}`
  );
}

/** Variables exposed to order templates (admin placeholders). */
function orderVars(order: Order): Record<string, string> {
  return {
    customerName: order.customer.name,
    customerEmail: order.customer.email,
    customerPhone: order.customer.phone ?? "",
    orderNumber: order.orderNumber,
    orderTotal: money2(order.pricing.grandTotal),
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    courier: order.fulfillment.courier ?? "",
    trackingNumber: order.fulfillment.trackingNumber ?? "",
    storeName: BRAND,
    itemsText: itemsHtml(order), // trusted HTML (raw) in templates
  };
}

/** Order placed — customer confirmation. */
export async function sendOrderPlaced(order: Order): Promise<void> {
  const to = order.customer.email;
  if (!to) return;

  const tpl = await emailService.renderEventOrNull("order_placed", orderVars(order), ["itemsText"]);
  const subject = tpl?.subject ?? `Order confirmed — ${order.orderNumber}`;
  const text =
    tpl?.text ??
    `Hi ${order.customer.name},\n\n` +
      `Thank you for your order! Here are the details:\n\n` +
      `Order: ${order.orderNumber}\n` +
      `Payment: ${order.paymentStatus} (${order.paymentMethod})\n\n` +
      `${itemsText(order)}\n\n` +
      `We'll notify you when it ships. You can track it anytime under My Orders.\n`;
  const html =
    tpl?.html ??
    wrapHtml(
      "Thank you for your order 🎉",
      `<p>Hi ${order.customer.name},</p>
       <p>We've received your order <b>${order.orderNumber}</b>.</p>
       ${itemsHtml(order)}
       <p style="margin-top:16px">Payment: <b>${order.paymentStatus}</b> (${order.paymentMethod})</p>
       <p>We'll email you again when it ships.</p>`,
    );
  await emailService.sendAndLog("order_placed", { to, subject, text, html });
}

/** Order placed — internal alert to the store's admin inbox. */
export async function sendAdminNewOrderAlert(order: Order, adminEmail: string): Promise<void> {
  const to = adminEmail?.trim();
  if (!to) return;
  const subject = `New order ${order.orderNumber} — ${money(order.pricing.grandTotal)}`;
  const text =
    `New order received.\n\n` +
    `Order: ${order.orderNumber}\n` +
    `Customer: ${order.customer.name} <${order.customer.email}>${order.customer.phone ? ` · ${order.customer.phone}` : ""}\n` +
    `Status: ${order.status} / ${order.paymentStatus} (${order.paymentMethod})\n\n` +
    `${itemsText(order)}\n`;
  const html = wrapHtml(
    `New order ${order.orderNumber}`,
    `<p><b>${order.customer.name}</b> &lt;${order.customer.email}&gt;${order.customer.phone ? ` · ${order.customer.phone}` : ""}</p>
     <p>Status: ${order.status} / ${order.paymentStatus} (${order.paymentMethod})</p>
     ${itemsHtml(order)}`,
  );

  const tpl = await emailService.renderEventOrNull("admin_new_order", orderVars(order), ["itemsText"]);
  await emailService.sendAndLog("admin_new_order", {
    to,
    subject: tpl?.subject ?? subject,
    text: tpl?.text ?? text,
    html: tpl?.html ?? html,
  });
}

/** Order shipped — tracking info for the customer. */
export async function sendOrderShipped(order: Order): Promise<void> {
  const to = order.customer.email;
  if (!to) return;
  const courier = order.fulfillment.courier;
  const tracking = order.fulfillment.trackingNumber;
  const subject = `Your order has shipped — ${order.orderNumber}`;
  const text =
    `Hi ${order.customer.name},\n\n` +
    `Good news — your order ${order.orderNumber} is on its way!\n\n` +
    (courier ? `Courier: ${courier}\n` : "") +
    (tracking ? `Tracking: ${tracking}\n` : "") +
    `\nThanks for shopping with ${BRAND}.\n`;
  const html = wrapHtml(
    "Your order is on its way 🚚",
    `<p>Hi ${order.customer.name},</p>
     <p>Your order <b>${order.orderNumber}</b> has shipped.</p>
     ${courier ? `<p style="color:#777">Courier: <b>${courier}</b></p>` : ""}
     ${tracking ? `<p style="color:#777">Tracking: <b>${tracking}</b></p>` : ""}`,
  );

  const tpl = await emailService.renderEventOrNull("order_shipped", orderVars(order));
  await emailService.sendAndLog("order_shipped", {
    to,
    subject: tpl?.subject ?? subject,
    text: tpl?.text ?? text,
    html: tpl?.html ?? html,
  });
}

/** Order delivered — thank-you / feedback prompt. */
export async function sendOrderDelivered(order: Order): Promise<void> {
  const to = order.customer.email;
  if (!to) return;
  const subject = `Delivered — ${order.orderNumber}`;
  const text =
    `Hi ${order.customer.name},\n\n` +
    `Your order ${order.orderNumber} has been delivered. We hope you love it!\n\n` +
    `We'd love your feedback — a quick review helps others choose the right stone.\n\n` +
    `Thank you for choosing ${BRAND}.\n`;
  const html = wrapHtml(
    "Your order has been delivered ✨",
    `<p>Hi ${order.customer.name},</p>
     <p>Your order <b>${order.orderNumber}</b> has been delivered. We hope you love it!</p>
     <p>We'd love your feedback — a quick review helps others choose the right stone.</p>`,
  );

  const tpl = await emailService.renderEventOrNull("order_delivered", orderVars(order));
  await emailService.sendAndLog("order_delivered", {
    to,
    subject: tpl?.subject ?? subject,
    text: tpl?.text ?? text,
    html: tpl?.html ?? html,
  });
}
