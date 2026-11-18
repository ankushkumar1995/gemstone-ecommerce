import "server-only";

/**
 * Partner agreement emails. All fire-and-forget except the OTP fallback,
 * which the caller awaits (it must know whether the code went out).
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

function fire(to: string, subject: string, text: string, html: string) {
  void sendMail({ to, subject, text, html }).catch((e) =>
    logger.error("agreement email failed", { subject, error: e instanceof Error ? e.message : String(e) }),
  );
}

/** OTP by email (fallback when SMS is unavailable). Returns whether it was really sent. */
export async function mailSigningOtp(to: string, name: string, code: string, version: string): Promise<boolean> {
  const t = `Namaste ${name}, your OTP to sign the ${BRAND} Partner Agreement v${version} is ${code}. It is valid for 5 minutes. Never share this code. If you did not try to sign, contact support.`;
  try {
    const r = await sendMail({
      to,
      subject: `${code} is your OTP to sign the partner agreement`,
      text: t,
      html: wrap("Your signing OTP", `<p>Namaste ${esc(name)},</p><p>Your one-time password to sign <b>Partner Agreement v${esc(version)}</b>:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:12px 0">${esc(code)}</p><p>It is valid for 5 minutes. Never share this code with anyone, including ${BRAND} staff.</p><p style="color:#999;font-size:12px">If you did not try to sign, contact support right away.</p>`),
    });
    return r.delivered;
  } catch (e) {
    logger.error("agreement otp email failed", { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

type Pdf = { filename: string; content: Buffer } | null;

/**
 * Signed copy email. The PDF is attached (the partner's own permanent copy);
 * the link works without login for `linkDays` days, so it still works if the
 * account is later suspended or closed.
 */
export function mailSigned(to: string, name: string, version: string, certificateNo: string, signedAtIst: string, link: string, pdf: Pdf, linkDays: number, resent = false) {
  const lead = resent ? `Here is your signed copy of the ${BRAND} Partner Agreement v${version} (signed on ${signedAtIst}).` : `You signed the ${BRAND} Partner Agreement v${version} on ${signedAtIst}.`;
  const t = `Namaste ${name}, ${lead} Certificate ${certificateNo}. ${pdf ? "The signed PDF is attached. Keep it for your records. " : ""}Download link (valid ${linkDays} days, no login needed): ${link}. If this was not you, contact support right away.`;
  const html = wrap(resent ? "Your signed agreement" : "Agreement signed", `<p>Namaste ${esc(name)},</p><p>${esc(lead)}</p><p>Certificate: <b>${esc(certificateNo)}</b></p>${pdf ? "<p>The signed PDF is attached. Please keep it for your records.</p>" : ""}<p><a href="${esc(link)}">Download your signed copy</a> <span style="color:#999;font-size:12px">(valid ${linkDays} days, no login needed)</span></p><p style="color:#999;font-size:12px">If this was not you, contact support right away.</p>`);
  void sendMail({
    to, subject: resent ? `Your signed Partner Agreement v${version}` : `Partner Agreement v${version} signed`, text: t, html,
    ...(pdf ? { attachments: [{ filename: pdf.filename, content: pdf.content, contentType: "application/pdf" }] } : {}),
  }).catch((e) => logger.error("agreement email failed", { error: e instanceof Error ? e.message : String(e) }));
}

export function mailReminder(to: string, name: string, version: string, deadlineIst: string, link: string) {
  const t = `Namaste ${name}, please review and sign the ${BRAND} Partner Agreement v${version} by ${deadlineIst}. After that you cannot go online until it is signed. Sign here: ${link}`;
  fire(to, `Please sign Partner Agreement v${version}`, t, wrap("Signature needed", `<p>Namaste ${esc(name)},</p><p>Please review and sign <b>Partner Agreement v${esc(version)}</b> by <b>${esc(deadlineIst)}</b>.</p><p>After the deadline you cannot go online until it is signed.</p><p><a href="${esc(link)}">Review and sign</a></p>`));
}

export function mailVoided(to: string, name: string, version: string, reason: string, link: string) {
  const t = `Namaste ${name}, your signature on the ${BRAND} Partner Agreement v${version} was cancelled by our team. Reason: ${reason}. Please sign again: ${link}`;
  fire(to, `Please sign Partner Agreement v${version} again`, t, wrap("Signature cancelled", `<p>Namaste ${esc(name)},</p><p>Your signature on <b>Partner Agreement v${esc(version)}</b> was cancelled by our team.</p><p><b>Reason:</b> ${esc(reason)}</p><p><a href="${esc(link)}">Sign again</a></p>`));
}

export function mailExtended(to: string, name: string, version: string, untilIst: string) {
  const t = `Namaste ${name}, you have extra time to sign the ${BRAND} Partner Agreement v${version}, until ${untilIst}.`;
  fire(to, `More time to sign v${version}`, t, wrap("Deadline extended", `<p>Namaste ${esc(name)},</p><p>You have until <b>${esc(untilIst)}</b> to sign <b>Partner Agreement v${esc(version)}</b>.</p>`));
}
