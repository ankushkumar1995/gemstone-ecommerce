import "server-only";

/**
 * Astrologer notification emails. Fire-and-forget: a mail failure must never
 * break the action that triggered it. When SMTP/Resend are not configured the
 * core mailer logs the message instead of sending (dev-safe).
 */

import { sendMail } from "@/core/mailer";
import { logger } from "@/core/logger";

const BRAND = "Astrounkle";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function wrap(title: string, body: string): string {
  return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#241a3b">
  <div style="padding:20px 24px;background:linear-gradient(135deg,#6d4bd8,#2a1d5e);border-radius:16px 16px 0 0"><h1 style="margin:0;color:#f4d58d;font-size:20px">${BRAND} Partner</h1></div>
  <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 16px 16px"><h2 style="margin:0 0 12px;font-size:18px">${esc(title)}</h2>${body}
  <p style="margin-top:24px;font-size:12px;color:#999">Team ${BRAND}</p></div></div>`;
}

async function send(to: string, subject: string, text: string, html: string) {
  try {
    await sendMail({ to, subject, text, html });
  } catch (e) {
    logger.error("astrologer email failed", { to, subject, error: e instanceof Error ? e.message : String(e) });
  }
}

export function mailApplicationReceived(to: string, name: string) {
  const t = `Namaste ${name}, we have received your partner application. Upload your KYC documents from the partner panel so our team can review it.`;
  void send(to, "We received your application", t, wrap("Application received", `<p>${esc(t)}</p>`));
}

export function mailInvite(to: string, name: string, tempPassword: string, loginUrl: string) {
  const t = `Namaste ${name}, you have been invited to join ${BRAND} as an astrologer. Sign in at ${loginUrl} with this email and the temporary password: ${tempPassword}. You will be asked to set a new password.`;
  void send(to, `You're invited to ${BRAND}`, t, wrap("Welcome aboard", `<p>Namaste ${esc(name)},</p><p>You have been invited to join ${BRAND} as an astrologer.</p><p>Sign in at <a href="${esc(loginUrl)}">${esc(loginUrl)}</a><br/>Temporary password: <b>${esc(tempPassword)}</b></p><p>You will be asked to set a new password after signing in.</p>`));
}

export function mailStatusChanged(to: string, name: string, status: string, reason?: string) {
  const human: Record<string, string> = {
    approved: "Your profile is approved. You can now go online and start taking consultations.",
    rejected: "Your application was not approved yet.",
    suspended: "Your account has been suspended.",
    under_review: "Your profile is under review.",
    deactivated: "Your account has been deactivated.",
  };
  const line = human[status] ?? `Your account status is now ${status}.`;
  const t = `Namaste ${name}, ${line}${reason ? ` Reason: ${reason}` : ""}`;
  void send(to, `Account update: ${status.replace("_", " ")}`, t, wrap("Account update", `<p>Namaste ${esc(name)},</p><p>${esc(line)}</p>${reason ? `<p><b>Reason:</b> ${esc(reason)}</p>` : ""}`));
}

export function mailKycReviewed(to: string, name: string, doc: string, status: string, note?: string) {
  const t = `Namaste ${name}, your ${doc} document was ${status}.${note ? ` Note: ${note}` : ""}`;
  void send(to, `KYC ${doc}: ${status}`, t, wrap("KYC update", `<p>${esc(t)}</p>`));
}

export function mailPasswordReset(to: string, name: string, link: string) {
  const t = `Namaste ${name}, reset your partner password using this link (valid for 1 hour): ${link}. If you did not ask for this, ignore this email.`;
  void send(to, "Reset your partner password", t, wrap("Reset password", `<p>Namaste ${esc(name)},</p><p><a href="${esc(link)}">Reset your password</a> (valid for 1 hour).</p><p>If you did not ask for this, you can ignore this email.</p>`));
}
