import "server-only";

/**
 * Transactional mailer (server-only).
 * ─────────────────────────────────────────────────────────────────────────
 * One place to send all transactional email. Design goals:
 *   • Works WITHOUT SMTP configured — in that case it logs the email (so the
 *     whole notification flow is wired and testable now; real delivery turns
 *     on the moment SMTP creds exist). This matches the "flows now, delivery
 *     after SMTP" plan.
 *   • SMTP connection details come from STORE SETTINGS (host/port/user/from);
 *     the password/secret comes ONLY from env (SMTP_PASSWORD) — never stored
 *     in the DB.
 *   • `nodemailer` is imported LAZILY and optionally — if it isn't installed,
 *     we fall back to logging instead of crashing. Install it to enable real
 *     sending:  npm i nodemailer   (and @types/nodemailer).
 */

import { env } from "@/core/config/env";

export interface MailMessage {
  to: string;
  subject: string;
  /** Plain-text body (always provided — the readable fallback). */
  text: string;
  /** Optional HTML body. */
  html?: string;
}

export interface MailResult {
  ok: boolean;
  delivered: boolean; // true only when actually sent via SMTP
  logged: boolean; // true when we logged instead of sending
  error?: string;
}

/** Resolve SMTP config from settings + env. Returns null if not fully set. */
async function resolveSmtp(): Promise<{
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
} | null> {
  const { settingsService } = await import("@/modules/settings");
  const res = await settingsService.get();
  if (!res.ok) return null;
  const em = res.value.email;
  const host = em.smtpHost?.trim();
  const user = em.smtpUser?.trim();
  const pass = env.SMTP_PASSWORD?.trim();
  // Need host + user + password + the admin flag flipped on.
  if (!em.smtpConfigured || !host || !user || !pass) return null;
  return {
    host,
    port: em.smtpPort ?? 587,
    user,
    pass,
    fromName: em.fromName || "Astrounkle",
    fromEmail: em.fromEmail,
    replyTo: em.replyTo || undefined,
  };
}

/**
 * Minimal shape of the bits of nodemailer we use. We type it ourselves so the
 * project compiles whether or not `nodemailer` is installed (it's optional).
 */
interface NodemailerLike {
  createTransport: (opts: unknown) => {
    sendMail: (opts: unknown) => Promise<unknown>;
  };
}

/** Lazy, optional nodemailer loader. Returns null if the package isn't present. */
async function loadNodemailer(): Promise<NodemailerLike | null> {
  try {
    // Variable specifier so TS/bundlers don't try to resolve it at build time.
    const name = "nodemailer";
    const mod = (await import(/* webpackIgnore: true */ name)) as unknown as
      | NodemailerLike
      | { default: NodemailerLike };
    return "createTransport" in mod ? mod : mod.default;
  } catch {
    return null;
  }
}

/**
 * Send a transactional email. Never throws — returns a result the caller can
 * ignore (notifications must not break the booking/order flow).
 */
export async function sendMail(msg: MailMessage): Promise<MailResult> {
  try {
    const smtp = await resolveSmtp();

    if (!smtp) {
      logEmail("SMTP not configured — logging only", msg);
      return { ok: true, delivered: false, logged: true };
    }

    const nodemailer = await loadNodemailer();
    if (!nodemailer) {
      logEmail("nodemailer not installed — logging only", msg);
      return { ok: true, delivered: false, logged: true };
    }

    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });

    await transport.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      replyTo: smtp.replyTo,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });

    return { ok: true, delivered: true, logged: false };
  } catch (e) {
    const error = e instanceof Error ? e.message : "send failed";
    logEmail(`send failed (${error}) — logged`, msg);
    return { ok: false, delivered: false, logged: true, error };
  }
}

/** Developer-visible log of an email that wasn't delivered. */
function logEmail(reason: string, msg: MailMessage): void {
  // eslint-disable-next-line no-console
  console.log(
    `\n📧 [mail:${reason}]\n  To:      ${msg.to}\n  Subject: ${msg.subject}\n  ${msg.text.replace(/\n/g, "\n  ")}\n`,
  );
}
