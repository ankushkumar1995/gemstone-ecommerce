import "server-only";

/**
 * Transactional mailer (server-only) — multi-provider with automatic fallback.
 * ─────────────────────────────────────────────────────────────────────────
 * One place to send all transactional email. Design:
 *   • Providers are admin-configured in STORE SETTINGS (`email.providers`):
 *     each has a `kind` (smtp | resend), an `enabled` flag and a `priority`.
 *     The engine tries ENABLED providers in ascending priority order and
 *     FALLS BACK to the next one if a send fails. Every attempt is recorded.
 *   • Secrets never live in the DB: SMTP password = env SMTP_PASSWORD, Resend
 *     key = env RESEND_API_KEY. A provider missing its secret is skipped.
 *   • Works WITHOUT any provider configured — it logs the email (so the whole
 *     notification flow is wired/testable now; real delivery turns on the
 *     moment a provider + secret exist).
 *   • `nodemailer` / `resend` are imported LAZILY and optionally — if a package
 *     isn't installed, that provider is skipped (no crash). Install to enable:
 *       npm i nodemailer @types/nodemailer resend
 *   • `sendMail` NEVER throws — a notification failure must not break the
 *     booking/order flow.
 */

import { env } from "@/core/config/env";
import type { EmailProviderConfig, EmailSettings } from "@/modules/settings/settings.types";

export interface MailMessage {
  to: string;
  subject: string;
  /** Plain-text body (always provided — the readable fallback). */
  text: string;
  /** Optional HTML body. */
  html?: string;
}

/** One provider's attempt outcome (for logging / the admin email log later). */
export interface MailAttempt {
  provider: EmailProviderConfig["kind"];
  delivered: boolean;
  skipped?: string; // reason it was skipped (not configured / package missing)
  error?: string; // reason it failed
}

export interface MailResult {
  ok: boolean;
  delivered: boolean; // true only when a provider actually sent it
  logged: boolean; // true when we logged instead of delivering
  provider?: EmailProviderConfig["kind"]; // which provider delivered
  attempts: MailAttempt[];
  error?: string;
}

interface FromInfo {
  fromName: string;
  fromEmail: string;
  replyTo?: string;
}

/* ------------------------------------------------------------------ *
 * Settings loader
 * ------------------------------------------------------------------ */

async function loadEmailSettings(): Promise<EmailSettings | null> {
  try {
    const { settingsService } = await import("@/modules/settings");
    const res = await settingsService.get();
    return res.ok ? res.value.email : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the ordered list of providers to try. Prefers the new `providers`
 * array; if absent (legacy settings), synthesises a single SMTP provider from
 * the old flat fields so nothing breaks.
 */
function resolveProviderOrder(email: EmailSettings): EmailProviderConfig[] {
  const list = Array.isArray(email.providers) ? email.providers : [];
  if (list.length === 0) {
    return [
      {
        kind: "smtp",
        enabled: Boolean(email.smtpConfigured),
        priority: 0,
        smtpHost: email.smtpHost,
        smtpPort: email.smtpPort,
        smtpUser: email.smtpUser,
      },
    ];
  }
  return [...list].filter((p) => p.enabled).sort((a, b) => a.priority - b.priority);
}

/* ------------------------------------------------------------------ *
 * Provider adapters — each returns a MailAttempt (never throws).
 * ------------------------------------------------------------------ */

/** Minimal nodemailer shape so the project compiles without the package. */
interface NodemailerLike {
  createTransport: (opts: unknown) => { sendMail: (opts: unknown) => Promise<unknown> };
}

async function loadNodemailer(): Promise<NodemailerLike | null> {
  try {
    const name = "nodemailer";
    const mod = (await import(/* webpackIgnore: true */ name)) as unknown as
      | NodemailerLike
      | { default: NodemailerLike };
    return "createTransport" in mod ? mod : mod.default;
  } catch {
    return null;
  }
}

async function sendViaSmtp(
  cfg: EmailProviderConfig,
  from: FromInfo,
  msg: MailMessage,
): Promise<MailAttempt> {
  const host = cfg.smtpHost?.trim() || undefined;
  const user = cfg.smtpUser?.trim() || undefined;
  const pass = env.SMTP_PASSWORD?.trim() || undefined;
  if (!host || !user || !pass) {
    return { provider: "smtp", delivered: false, skipped: "SMTP host/user/password not set" };
  }
  const nodemailer = await loadNodemailer();
  if (!nodemailer) {
    return { provider: "smtp", delivered: false, skipped: "nodemailer not installed" };
  }
  try {
    const port = cfg.smtpPort ?? 587;
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transport.sendMail({
      from: `"${from.fromName}" <${from.fromEmail}>`,
      replyTo: from.replyTo,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    return { provider: "smtp", delivered: true };
  } catch (e) {
    return { provider: "smtp", delivered: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Minimal Resend shape so the project compiles without the package. */
interface ResendLike {
  new (apiKey: string): {
    emails: { send: (opts: unknown) => Promise<{ error?: { message?: string } | null }> };
  };
}

async function loadResend(): Promise<ResendLike | null> {
  try {
    const name = "resend";
    const mod = (await import(/* webpackIgnore: true */ name)) as unknown as {
      Resend?: ResendLike;
    };
    return mod.Resend ?? null;
  } catch {
    return null;
  }
}

async function sendViaResend(from: FromInfo, msg: MailMessage): Promise<MailAttempt> {
  const key = env.RESEND_API_KEY?.trim() || undefined;
  if (!key) {
    return { provider: "resend", delivered: false, skipped: "RESEND_API_KEY not set" };
  }
  const Resend = await loadResend();
  if (!Resend) {
    return { provider: "resend", delivered: false, skipped: "resend package not installed" };
  }
  try {
    const client = new Resend(key);
    const result = await client.emails.send({
      from: `${from.fromName} <${from.fromEmail}>`,
      replyTo: from.replyTo,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    if (result?.error) {
      return { provider: "resend", delivered: false, error: result.error.message ?? "resend error" };
    }
    return { provider: "resend", delivered: true };
  } catch (e) {
    return { provider: "resend", delivered: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

async function sendViaProvider(
  cfg: EmailProviderConfig,
  from: FromInfo,
  msg: MailMessage,
): Promise<MailAttempt> {
  switch (cfg.kind) {
    case "smtp":
      return sendViaSmtp(cfg, from, msg);
    case "resend":
      return sendViaResend(from, msg);
    default:
      return { provider: cfg.kind, delivered: false, skipped: "unknown provider" };
  }
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * Send a transactional email through the configured providers with fallback.
 * Never throws. Returns a result the caller can ignore.
 */
export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const email = await loadEmailSettings();
  if (!email) {
    logEmail("no email settings — logging only", msg);
    return { ok: true, delivered: false, logged: true, attempts: [] };
  }

  const from: FromInfo = {
    fromName: email.fromName || "Astrounkle",
    fromEmail: email.fromEmail,
    replyTo: email.replyTo || undefined,
  };

  const providers = resolveProviderOrder(email);
  const attempts: MailAttempt[] = [];

  for (const cfg of providers) {
    const attempt = await sendViaProvider(cfg, from, msg);
    attempts.push(attempt);
    if (attempt.delivered) {
      return { ok: true, delivered: true, logged: false, provider: cfg.kind, attempts };
    }
    // not delivered → try next provider (fallback)
  }

  // Nothing delivered — log so the flow is visible in dev.
  const why =
    providers.length === 0
      ? "no enabled providers"
      : attempts.map((a) => `${a.provider}:${a.skipped ?? a.error ?? "failed"}`).join(" → ");
  logEmail(`not delivered (${why}) — logging only`, msg);
  return {
    ok: attempts.every((a) => !a.error), // ok unless a real error occurred
    delivered: false,
    logged: true,
    attempts,
    error: attempts.find((a) => a.error)?.error,
  };
}

/** Developer-visible log of an email that wasn't delivered. */
function logEmail(reason: string, msg: MailMessage): void {
  console.log(
    `\n📧 [mail:${reason}]\n  To:      ${msg.to}\n  Subject: ${msg.subject}\n  ${msg.text.replace(/\n/g, "\n  ")}\n`,
  );
}
