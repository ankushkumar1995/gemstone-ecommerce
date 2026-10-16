import "server-only";

/**
 * Booking email templates + senders. Each function builds a branded message
 * and sends it via the core mailer (which delivers when SMTP is set, else
 * logs). Senders never throw — a notification failure must not break a booking.
 */

import { sendMail } from "@/core/mailer";
import type { Booking } from "./booking.types";

const BRAND = "Astrounkle";

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

/** Booking confirmed (after payment / manual confirm). */
export async function sendBookingConfirmed(b: Booking): Promise<void> {
  const to = b.customer.email;
  if (!to) return;
  const subject = `Booking confirmed — ${b.serviceTitle} (${b.bookingNumber})`;
  const text =
    `Hi ${b.customer.name},\n\n` +
    `Your booking is confirmed.\n\n` +
    `Service: ${b.serviceTitle}\n` +
    `Booking ref: ${b.bookingNumber}\n` +
    `Amount: ${money(b.amount)} (${b.paymentStatus})\n\n` +
    `Our astrologer will reach out to schedule your session. You can view it anytime under My Bookings.\n`;
  const html = wrapHtml(
    "Your booking is confirmed 🎉",
    `<p>Hi ${b.customer.name},</p>
     <p>Thanks for booking with us. Here are your details:</p>
     <table style="font-size:14px;line-height:1.9">
       <tr><td style="color:#777">Service</td><td style="padding-left:16px"><b>${b.serviceTitle}</b></td></tr>
       <tr><td style="color:#777">Booking ref</td><td style="padding-left:16px"><b>${b.bookingNumber}</b></td></tr>
       <tr><td style="color:#777">Amount</td><td style="padding-left:16px"><b>${money(b.amount)}</b> (${b.paymentStatus})</td></tr>
     </table>
     <p>Our astrologer will reach out to schedule your session.</p>`,
  );
  await sendMail({ to, subject, text, html });
}

/** Appointment scheduled by the admin. */
export async function sendBookingScheduled(b: Booking): Promise<void> {
  const to = b.customer.email;
  if (!to || !b.scheduledAt) return;
  const when = new Date(b.scheduledAt).toLocaleString("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
  });
  const subject = `Appointment scheduled — ${b.serviceTitle}`;
  const text =
    `Hi ${b.customer.name},\n\n` +
    `Your ${b.serviceTitle} session is scheduled for:\n${when}\n\n` +
    `Ref: ${b.bookingNumber}\n` +
    (b.adminNotes ? `\nNote from our team:\n${b.adminNotes}\n` : "") +
    `\nSee you then!\n`;
  const html = wrapHtml(
    "Your appointment is scheduled 📅",
    `<p>Hi ${b.customer.name},</p>
     <p>Your <b>${b.serviceTitle}</b> session is scheduled for:</p>
     <p style="font-size:16px;font-weight:600;color:#6d4bd8">${when}</p>
     <p style="color:#777">Ref: ${b.bookingNumber}</p>
     ${b.adminNotes ? `<p style="background:#faf7ef;padding:12px;border-radius:8px">${b.adminNotes}</p>` : ""}`,
  );
  await sendMail({ to, subject, text, html });
}

/** Service delivered / completed. */
export async function sendBookingCompleted(b: Booking): Promise<void> {
  const to = b.customer.email;
  if (!to) return;
  const subject = `Your ${b.serviceTitle} is ready`;
  const text =
    `Hi ${b.customer.name},\n\n` +
    `Your ${b.serviceTitle} (${b.bookingNumber}) is complete.\n\n` +
    (b.adminNotes ? `${b.adminNotes}\n\n` : "") +
    `Thank you for choosing ${BRAND}. We'd love your feedback!\n`;
  const html = wrapHtml(
    "Your consultation is complete ✨",
    `<p>Hi ${b.customer.name},</p>
     <p>Your <b>${b.serviceTitle}</b> (${b.bookingNumber}) is complete.</p>
     ${b.adminNotes ? `<p style="background:#faf7ef;padding:12px;border-radius:8px">${b.adminNotes}</p>` : ""}
     <p>Thank you for choosing ${BRAND}. We'd love your feedback!</p>`,
  );
  await sendMail({ to, subject, text, html });
}
