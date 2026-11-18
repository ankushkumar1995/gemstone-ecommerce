import "server-only";

/**
 * Phone OTP sign-in (website + app).
 *
 * send:   6 digits, valid 5 min, stored as HMAC only. Limits (stored in the
 *         DB so they hold across servers): 30 s between sends to a number,
 *         5 per number / hour, 20 per IP / hour, 10 per device / hour.
 * verify: 5 wrong tries lock that number for 15 min. A code works once.
 *         Then: existing customer with this VERIFIED phone → sign in.
 *               exactly one customer with this phone saved but unverified
 *               (e.g. typed by admin or at checkout) → that account, now verified.
 *               nobody → new account (name filled in later in profile setup).
 *
 * Delivery: SMS through core/sms. No provider yet → the code is returned in
 * the response (shown on screen) outside production, or in production only
 * with OTP_DEMO_MODE=true. Responses never reveal whether a number is registered.
 */

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { env } from "@/core/config/env";
import { logger } from "@/core/logger";
import { sendSms, maskPhone } from "@/core/sms";
import { BRAND } from "@/lib/brand";
import { sessionService, type SessionCtx, type SessionTokens } from "./session.service";
import { toPublic, type CustomerPublic } from "./customer-auth.service";

const TTL_MS = 5 * 60_000;
const RESEND_MS = 30_000;
const PER_PHONE_HOUR = 5;
const PER_IP_HOUR = 20;
const PER_DEVICE_HOUR = 10;
const MAX_WRONG = 5;
const LOCK_MS = 15 * 60_000;

const pepper = () => (env.ADMIN_SESSION_SECRET || "astrounkle-dev-only-customer-otp-pepper") + "::customer-otp";
const hmac = (phone: string, createdAt: string, code: string) => createHmac("sha256", pepper()).update(`${phone}|${createdAt}|${code}`).digest("hex");

/** Indian mobile → E.164 (+91XXXXXXXXXX). Null if not a valid Indian mobile. */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, "").replace(/^\+?91(?=\d{10}$)/, "").replace(/^0(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}

export const demoOtpAllowed = () => env.NODE_ENV !== "production" || env.OTP_DEMO_MODE === "true";

async function models() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  const [{ OtpModel }, { CustomerModel }] = await Promise.all([import("./otp.model"), import("@/modules/customers/customer.model")]);
  return { OtpModel, CustomerModel };
}

export interface OtpSent { sentTo: string; expiresIn: number; resendIn: number; demoCode?: string }

export const otpService = {
  async send(rawPhone: string, ctx: SessionCtx): Promise<Result<OtpSent>> {
    const phone = normalizePhone(rawPhone);
    if (!phone) return fail(AppErrors.validation("Enter a valid 10-digit Indian mobile number"));
    const { OtpModel } = await models();
    const now = Date.now();
    const hourAgo = new Date(now - 3600_000);

    const [last, perPhone, perIp, perDevice, locked] = await Promise.all([
      OtpModel.findOne({ phone }).sort({ createdAt: -1 }).lean<{ createdAt: Date }>(),
      OtpModel.countDocuments({ phone, createdAt: { $gte: hourAgo } }),
      ctx.ip && ctx.ip !== "unknown" ? OtpModel.countDocuments({ ip: ctx.ip, createdAt: { $gte: hourAgo } }) : Promise.resolve(0),
      OtpModel.countDocuments({ deviceId: ctx.deviceId, createdAt: { $gte: hourAgo } }),
      OtpModel.findOne({ phone, lockedUntil: { $gt: new Date(now) } }).lean<{ lockedUntil: Date }>(),
    ]);
    if (locked) return fail(AppErrors.rateLimited(`Too many wrong codes. Try again in ${Math.ceil((locked.lockedUntil.getTime() - now) / 60000)} min.`, { reason: "LOCKED" }));
    if (last && now - last.createdAt.getTime() < RESEND_MS) {
      return fail(AppErrors.rateLimited(`Wait ${Math.ceil((RESEND_MS - (now - last.createdAt.getTime())) / 1000)} s before asking for a new code.`, { reason: "RESEND_WAIT" }));
    }
    if (perPhone >= PER_PHONE_HOUR || perIp >= PER_IP_HOUR || perDevice >= PER_DEVICE_HOUR) {
      return fail(AppErrors.rateLimited("Too many codes requested. Please try again in an hour.", { reason: "HOURLY_LIMIT" }));
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const createdAt = new Date(now);
    const sms = await sendSms({ to: phone, text: `${code} is your ${BRAND.name} login code. Valid for 5 minutes. Do not share it with anyone.`, templateId: env.SMS_OTP_TEMPLATE_ID });
    if (!sms.delivered && !demoOtpAllowed()) {
      logger.error("customer otp not delivered", { phone: maskPhone(phone), reason: sms.reason });
      return fail(AppErrors.internal("We could not send the code right now. Please try again in a minute."));
    }
    // Older open codes for this number stop working once a new one is sent.
    await OtpModel.updateMany({ phone, consumedAt: null }, { $set: { consumedAt: createdAt } });
    await OtpModel.create({
      phone, codeHash: hmac(phone, createdAt.toISOString(), code), createdAt, expiresAt: new Date(now + TTL_MS),
      ip: ctx.ip, deviceId: ctx.deviceId, delivered: sms.delivered, purgeAt: new Date(now + 2 * 3600_000),
    });
    return ok({ sentTo: maskPhone(phone), expiresIn: TTL_MS / 1000, resendIn: RESEND_MS / 1000, ...(sms.delivered ? {} : { demoCode: code }) });
  },

  async verify(rawPhone: string, code: string, ctx: SessionCtx): Promise<Result<{ customer: CustomerPublic; tokens: SessionTokens; isNew: boolean }>> {
    const phone = normalizePhone(rawPhone);
    if (!phone || !/^\d{6}$/.test(code)) return fail(AppErrors.validation("Enter the 6-digit code"));
    const { OtpModel, CustomerModel } = await models();
    const now = new Date();

    const locked = await OtpModel.findOne({ phone, lockedUntil: { $gt: now } }).lean();
    if (locked) return fail(AppErrors.rateLimited("Too many wrong codes. Please try again in 15 minutes.", { reason: "LOCKED" }));
    const ch = await OtpModel.findOne({ phone, consumedAt: null }).sort({ createdAt: -1 }).lean<{ _id: unknown; codeHash: string; createdAt: Date; expiresAt: Date; attempts: number }>();
    if (!ch) return fail(AppErrors.validation("Code expired. Please request a new one.", { reason: "OTP_EXPIRED" }));
    if (ch.expiresAt <= now) return fail(AppErrors.validation("Code expired. Please request a new one.", { reason: "OTP_EXPIRED" }));

    // Count the attempt atomically before comparing.
    const counted = await OtpModel.findOneAndUpdate({ _id: ch._id, consumedAt: null, attempts: { $lt: MAX_WRONG } }, { $inc: { attempts: 1 } }, { returnDocument: "after" }).lean<{ attempts: number }>();
    if (!counted) return fail(AppErrors.validation("Code expired. Please request a new one.", { reason: "OTP_EXPIRED" }));
    const a = Buffer.from(hmac(phone, ch.createdAt.toISOString(), code), "hex");
    const b = Buffer.from(ch.codeHash, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      const left = MAX_WRONG - counted.attempts;
      if (left <= 0) {
        await OtpModel.updateOne({ _id: ch._id }, { $set: { lockedUntil: new Date(now.getTime() + LOCK_MS), consumedAt: now, purgeAt: new Date(now.getTime() + LOCK_MS + 3600_000) } });
        return fail(AppErrors.rateLimited("Too many wrong codes. Please try again in 15 minutes.", { reason: "LOCKED" }));
      }
      return fail(AppErrors.validation(`Wrong code. ${left} ${left === 1 ? "try" : "tries"} left.`, { reason: "WRONG_OTP", triesLeft: left }));
    }
    const used = await OtpModel.updateOne({ _id: ch._id, consumedAt: null }, { $set: { consumedAt: now } });
    if (used.modifiedCount !== 1) return fail(AppErrors.validation("Code already used. Please request a new one.", { reason: "OTP_USED" }));

    // ---- find or create the account ----
    const local = phone.slice(3);
    const alive = { isDeleted: { $ne: true } };
    let doc = await CustomerModel.findOne({ ...alive, phone, phoneVerified: true }).lean();
    let isNew = false;
    if (!doc) {
      // Unverified matches (any common format). Link only when it's unambiguous.
      const candidates = await CustomerModel.find({ ...alive, phoneVerified: { $ne: true }, phone: { $in: [phone, local, `91${local}`, `+91 ${local}`, `0${local}`] } }).select("_id").limit(3).lean();
      if (candidates.length > 1) {
        return fail(AppErrors.conflict("More than one account uses this number. Please contact support to merge them.", { reason: "PHONE_AMBIGUOUS" }));
      }
      if (candidates.length === 1) {
        doc = await CustomerModel.findOneAndUpdate({ _id: candidates[0]._id }, { $set: { phone, phoneVerified: true } }, { returnDocument: "after" }).lean();
      } else {
        try {
          const created = await CustomerModel.create({
            phone, phoneVerified: true, provider: "phone", emailVerified: false, tokenVersion: 0, status: "active",
            activity: [{ id: `cact_${Date.now()}`, at: now.toISOString(), type: "created", message: `Account created with phone OTP (${ctx.client})`, actor: "Customer" }],
          });
          doc = created.toObject();
          isNew = true;
        } catch (e) {
          // Two verifications for a brand new number at the same moment: the unique index lets one win.
          if ((e as { code?: number }).code === 11000) doc = await CustomerModel.findOne({ ...alive, phone, phoneVerified: true }).lean();
          else throw e;
        }
      }
    }
    if (!doc) return fail(AppErrors.internal("Could not sign you in. Please try again."));
    if (doc.status === "blocked") return fail(AppErrors.forbidden("This account has been disabled. Contact support."));

    const tokens = await sessionService.create(String(doc._id), ctx);
    return ok({ customer: toPublic(doc), tokens, isNew });
  },
};
