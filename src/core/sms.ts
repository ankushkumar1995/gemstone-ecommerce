import "server-only";

/**
 * Transactional SMS (OTPs). Provider-agnostic: callers use `sendSms` and never
 * know which gateway is behind it. Never throws.
 *
 * No provider is connected yet. Until one is:
 *  • `sendSms` returns { delivered: false, reason: "not_configured" } and logs
 *    a masked line (never the message body, it may hold an OTP)
 *  • callers decide the fallback (agreement OTP: dev shows the code on screen,
 *    production falls back to email)
 *
 * To go live: set SMS_PROVIDER (+ SMS_API_KEY, SMS_SENDER_ID and the DLT
 * approved SMS_OTP_TEMPLATE_ID) and add the provider's HTTP call below.
 */

import { env } from "@/core/config/env";
import { logger } from "@/core/logger";

export interface SmsMessage {
  /** 10-digit Indian mobile (with or without +91). */
  to: string;
  text: string;
  /** DLT template id (required by Indian operators for OTP SMS). */
  templateId?: string;
}

export interface SmsResult {
  delivered: boolean;
  provider: string | null;
  reason?: "not_configured" | "unsupported_provider" | "invalid_number" | "provider_error";
}

const normalize = (p: string) => p.replace(/[\s-]/g, "").replace(/^\+?91/, "").slice(-10);
export const maskPhone = (p: string) => {
  const n = normalize(p);
  return n.length >= 4 ? `••••••${n.slice(-4)}` : "your mobile";
};

/** True once a provider is configured (used to tell the UI which channel to expect). */
export function smsConfigured(): boolean {
  return Boolean(env.SMS_PROVIDER && env.SMS_API_KEY);
}

export async function sendSms(msg: SmsMessage): Promise<SmsResult> {
  const to = normalize(msg.to);
  if (!/^[6-9]\d{9}$/.test(to)) return { delivered: false, provider: null, reason: "invalid_number" };

  if (!smsConfigured()) {
    logger.info("sms not sent: no provider configured", { to: maskPhone(to) });
    return { delivered: false, provider: null, reason: "not_configured" };
  }

  const provider = String(env.SMS_PROVIDER).toLowerCase();
  try {
    switch (provider) {
      // case "msg91": return await sendViaMsg91(to, msg);   // add when the account is ready
      // case "twilio": return await sendViaTwilio(to, msg);
      default:
        logger.error("sms provider not supported yet", { provider });
        return { delivered: false, provider, reason: "unsupported_provider" };
    }
  } catch (e) {
    logger.error("sms send failed", { provider, to: maskPhone(to), error: e instanceof Error ? e.message : String(e) });
    return { delivered: false, provider, reason: "provider_error" };
  }
}
