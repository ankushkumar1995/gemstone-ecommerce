import "server-only";

/**
 * Partner agreements — business rules.
 *
 * Versions
 *  • Only drafts can be edited or deleted. Publishing fixes the text hash,
 *    makes the version current and retires the older published ones.
 *  • A new version number must be higher than every earlier one.
 *
 * Signing (all checked on the server, again at sign time)
 *  • the version is still current and its hash matches what the partner read
 *  • every key point is ticked, and the typed name matches the KYC legal name
 *  • OTP: SMS to the registered mobile (email fallback in production while no
 *    SMS provider is connected; dev shows the code on screen). 6 digits,
 *    5 min validity, resend after 30 s, max 5 per hour, 3 wrong tries lock
 *    signing for 10 min. Stored as an HMAC only, consumed exactly once.
 *  • one live signature per partner per version (unique index)
 *
 * Online gate
 *  • blocked: never signed any version (new partner), or the deadline
 *    (or personal extension) for the current version has passed
 *  • pending: current version unsigned, still before the deadline
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { env } from "@/core/config/env";
import { cache } from "@/core/cache";
import { newId } from "@/core/id";
import { logger } from "@/core/logger";
import { sendSms, maskPhone, type SmsResult } from "@/core/sms";
import { BRAND } from "@/lib/brand";
import { auditService } from "@/modules/audit";
import { getAstrologerRepository } from "@/modules/astrologers/astrologer.repository";
import type { Astrologer } from "@/modules/astrologers/astrologer.types";
import { notifyPartner } from "@/modules/partner-notices";
import { contentHashOf, fingerprintOf, hashOtp, newOtpCode, otpBinding, otpMatches } from "./agreement.crypto";
import { mailExtended, mailReminder, mailSigned, mailSigningOtp, mailVoided } from "./agreement.emails";
import { archivePdf, copyToken, COPY_LINK_DAYS, readArchivedPdf, verifyCopyToken } from "./agreement.files";
import { pdfFileName, renderAgreementPdf } from "./agreement.pdf";
import { getAgreementRepository, MAX_OTP_ATTEMPTS } from "./agreement.repository";
import { VERSION_RE, type DraftDto, type DraftUpdateDto, type OtpRequestDto, type SignDto } from "./agreement.schema";
import type {
  AgreementAcceptance, AgreementActivity, AgreementClause, AgreementExtension, AgreementGateInfo, AgreementKeyPoint,
  AgreementListItem, AgreementVersion, OtpSendResult, PartnerAcceptanceView, PartnerAgreementState, PartnerAgreementView,
  SignatureRow, SignedCopy,
} from "./agreement.types";

export interface Actor { name: string }
export type SignupConsent = NonNullable<Astrologer["signupConsent"]>;
export interface RequestCtx { ip: string; userAgent: string }

/* ---------------- limits ---------------- */
export const OTP_TTL_MS = 5 * 60_000;
export const OTP_RESEND_MS = 30_000;
export const OTP_MAX_PER_HOUR = 5;
export const OTP_LOCK_MS = 10 * 60_000;
const MAX_EXTENSION_DAYS = 90;
const GATE_TTL = 20; // seconds; cleared on every write

/* ---------------- helpers ---------------- */

const nowIso = () => new Date().toISOString();
const isProd = () => env.NODE_ENV === "production";
/** Signing OTP is strict (SMS, then email, else refuse) only in production without OTP_DEMO_MODE. Demo mode = local behaviour: OTP shown on screen when SMS is not connected. */
const strictOtp = () => isProd() && env.OTP_DEMO_MODE !== "true";
const panelUrl = (path: string) => `${BRAND.url}${path}`;
const invalidate = () => cache.delByPrefix("agreements:");

/** Name comparison that ignores case, dots and extra spaces ("Dr. R.K. Sharma" == "dr r k sharma"). */
export const normName = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\./g, " ").replace(/\s+/g, " ").trim();

export function maskIp(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";
  if (ip.includes(".")) { const p = ip.split("."); return p.length === 4 ? `${p[0]}.${p[1]}.xx.xx` : "xx.xx.xx.xx"; }
  const g = ip.split(":").filter(Boolean);
  return g.length >= 2 ? `${g[0]}:${g[1]}:xxxx::` : "xxxx::";
}

export function deviceLabel(ua: string): string {
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Unknown OS";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

const maskEmail = (e: string) => { const [u, d] = e.split("@"); return d ? `${u.slice(0, 1)}••••@${d}` : "your email"; };

export const ist = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " IST";

/** -1 / 0 / 1 for dotted numeric versions ("3.10" > "3.9"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function nextVersion(versions: AgreementVersion[]): string {
  const top = [...versions].sort((x, y) => compareVersions(y.version, x.version))[0]?.version;
  if (!top) return "1.0";
  const parts = top.split(".").map(Number);
  if (parts.length === 1) parts.push(0);
  parts[parts.length - 1] += 1;
  return parts.join(".");
}

const act = (actor: string, action: string, note?: string): AgreementActivity => ({ at: nowIso(), actor, action, ...(note ? { note } : {}) });

const withIds = <T extends { id?: string }>(items: T[], prefix: string): (T & { id: string })[] =>
  items.map((x) => ({ ...x, id: x.id && x.id.trim() ? x.id : `${prefix}_${Math.random().toString(36).slice(2, 9)}` }));

const toPartnerView = (v: AgreementVersion): PartnerAgreementView => {
  const { activity: _a, createdBy: _c, publishedBy: _p, ...rest } = v;
  void _a; void _c; void _p;
  return rest;
};
const toPartnerAcceptance = (a: AgreementAcceptance): PartnerAcceptanceView => {
  const { ip: _i, userAgent: _u, voidedBy: _v, ...rest } = a;
  void _i; void _u; void _v;
  return rest;
};

async function logOnAstrologer(astrologerId: string, message: string, actor: string) {
  try {
    const repo = getAstrologerRepository();
    const a = await repo.findById(astrologerId);
    if (!a) return;
    const e = { id: newId("aact"), at: nowIso(), type: "agreement" as const, message, actor };
    await repo.update(astrologerId, { activity: [e, ...a.activity].slice(0, 80) });
  } catch (e) {
    logger.error("agreement: could not log on astrologer", { astrologerId, error: e instanceof Error ? e.message : String(e) });
  }
}

const audit = (action: "create" | "update" | "delete" | "status", id: string, label: string, summary: string, actor?: string) =>
  auditService.record({ action, entity: "agreement", entityId: id, entityLabel: label, summary, actor });

function verifyCopy(acc: AgreementAcceptance, v: AgreementVersion) {
  const textIntact = v.contentHash === acc.contentHash && contentHashOf(v) === acc.contentHash;
  const fingerprintIntact = fingerprintOf({ contentHash: acc.contentHash, astrologerId: acc.astrologerId, typedName: acc.typedName, signedAt: acc.signedAt, challengeId: acc.otp.challengeId, prevFingerprint: acc.prevFingerprint }) === acc.fingerprint;
  return { textIntact, fingerprintIntact };
}

/** Validate a draft's dates + content; returns an error message or null. */
function draftIssue(d: { effectiveFrom: string; signDeadline: string }): string | null {
  const ef = Date.parse(d.effectiveFrom), dl = Date.parse(d.signDeadline);
  if (Number.isNaN(ef) || Number.isNaN(dl)) return "Enter valid dates";
  if (dl < ef) return "The signing deadline cannot be before the effective date";
  return null;
}

/* ---------------- PDF ---------------- */

export interface PdfFile { bytes: Uint8Array; filename: string; source: "archive" | "generated" }

/** Make the PDF and archive it once (write-once on the record). */
async function archiveSignedPdf(acc: AgreementAcceptance, v: AgreementVersion): Promise<{ bytes: Uint8Array; record: AgreementAcceptance["pdf"] } | null> {
  try {
    const bytes = await renderAgreementPdf(toPartnerView(v), acc);
    // Null when S3 is not configured: the PDF is still emailed and can be re-generated.
    const record = await archivePdf(acc.astrologerId, acc.certificateNo, bytes);
    if (record) await getAgreementRepository().setPdf(acc.id, record);
    return { bytes, record };
  } catch (e) {
    logger.error("agreement pdf failed", { acceptanceId: acc.id, error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/**
 * The PDF for a signature. The archived copy (made at signing) is served when
 * it exists and its hash still matches; a voided signature is always freshly
 * rendered so the VOID mark shows. Otherwise it is generated from the record.
 */
async function pdfFor(acc: AgreementAcceptance): Promise<Result<PdfFile>> {
  const filename = pdfFileName(acc.version, acc.certificateNo);
  if (acc.pdf && !acc.voided) {
    const bytes = await readArchivedPdf(acc.pdf.key, acc.pdf.sha256);
    if (bytes) return ok({ bytes, filename, source: "archive" });
  }
  const v = await getAgreementRepository().getVersion(acc.agreementId);
  if (!v) return fail(AppErrors.notFound("Agreement version not found"));
  try {
    return ok({ bytes: await renderAgreementPdf(toPartnerView(v), acc), filename, source: "generated" });
  } catch (e) {
    logger.error("agreement pdf render failed", { acceptanceId: acc.id, error: e instanceof Error ? e.message : String(e) });
    return fail(AppErrors.internal("Could not create the PDF. Try again."));
  }
}

function sendCopyEmail(acc: AgreementAcceptance, v: AgreementVersion, bytes: Uint8Array | null, resent: boolean) {
  const link = panelUrl(`/api/v1/agreements/copies/${acc.id}/pdf?t=${encodeURIComponent(copyToken(acc.id))}`);
  const name = acc.signer.displayName.split(" ")[0] || acc.signer.displayName;
  mailSigned(acc.signer.email, name, v.version, acc.certificateNo, ist(acc.signedAt), link,
    bytes ? { filename: pdfFileName(v.version, acc.certificateNo), content: Buffer.from(bytes) } : null, COPY_LINK_DAYS, resent);
}

/* ---------------- gate ---------------- */

async function computeGate(a: Astrologer): Promise<AgreementGateInfo> {
  const repo = getAgreementRepository();
  const current = await repo.currentPublished();
  if (!current) return { gate: "none", version: null, agreementId: null, deadline: null, extendedUntil: null, signed: false, reason: null };
  const [signed, ext, mine] = await Promise.all([
    repo.activeAcceptance(a.id, current.id),
    repo.getExtension(current.id, a.id),
    repo.acceptancesForPartner(a.id),
  ]);
  const base = { version: current.version, agreementId: current.id, extendedUntil: ext?.until ?? null };
  const deadline = ext && ext.until > current.signDeadline ? ext.until : current.signDeadline;
  if (signed) return { ...base, gate: "none", deadline, signed: true, reason: null };
  const everSigned = mine.some((x) => !x.voided);
  if (!everSigned) {
    return { ...base, gate: "blocked", deadline, signed: false, reason: `Sign the partner agreement v${current.version} before you go online.` };
  }
  if (Date.now() > Date.parse(deadline)) {
    return { ...base, gate: "blocked", deadline, signed: false, reason: `The deadline to sign partner agreement v${current.version} has passed. Sign it to go online again.` };
  }
  return { ...base, gate: "pending", deadline, signed: false, reason: null };
}

/* ---------------- shared signing checks ---------------- */

async function checkSignable(a: Astrologer, dto: OtpRequestDto): Promise<Result<AgreementVersion>> {
  const repo = getAgreementRepository();
  const current = await repo.currentPublished();
  if (!current) return fail(AppErrors.notFound("There is no agreement to sign right now"));
  if (current.id !== dto.agreementId || current.contentHash !== dto.contentHash) {
    return fail(AppErrors.conflict("A newer version of the agreement was published. Please read it again.", { reason: "VERSION_CHANGED" }));
  }
  if (await repo.activeAcceptance(a.id, current.id)) return fail(AppErrors.conflict(`You have already signed v${current.version}`, { reason: "ALREADY_SIGNED" }));
  const need = current.keyPoints.map((k) => k.id);
  const got = new Set(dto.keyPoints);
  if (need.some((id) => !got.has(id))) return fail(AppErrors.validation("Tick every point to confirm you understand it"));
  if (!a.legalName?.trim()) return fail(AppErrors.validation("Your legal name is missing. Contact support to add it."));
  if (normName(dto.typedName) !== normName(a.legalName)) {
    return fail(AppErrors.validation("The name does not match your KYC legal name. If your KYC name is wrong, contact support.", { reason: "NAME_MISMATCH" }));
  }
  return ok(current);
}

/* ================================================================== */

export const agreementService = {
  /* ---------------- partner ---------------- */

  /** Online gate for a partner (cached briefly; called on every heartbeat). */
  async gate(a: Astrologer): Promise<AgreementGateInfo> {
    return cache.wrap(`agreements:gate:${a.id}`, GATE_TTL, () => computeGate(a));
  },

  async state(a: Astrologer): Promise<PartnerAgreementState> {
    const repo = getAgreementRepository();
    const [gate, current, history, recent] = await Promise.all([
      computeGate(a),
      repo.currentPublished(),
      repo.acceptancesForPartner(a.id),
      repo.recentOtps(a.id, new Date(Date.now() - 3600_000).toISOString()),
    ]);
    const now = Date.now();
    const latest = recent[0];
    const pending = latest && current && !latest.consumedAt && latest.agreementId === current.id && Date.parse(latest.expiresAt) > now ? latest : null;
    const lock = recent.map((o) => o.lockedUntil).filter((x): x is string => !!x && Date.parse(x) > now).sort().pop() ?? null;
    const resendAt = latest && Date.parse(latest.createdAt) + OTP_RESEND_MS > now ? new Date(Date.parse(latest.createdAt) + OTP_RESEND_MS).toISOString() : null;
    const signature = current ? history.find((h) => h.agreementId === current.id && !h.voided) ?? null : null;
    return {
      ...gate,
      current: current ? toPartnerView(current) : null,
      signature: signature ? toPartnerAcceptance(signature) : null,
      history: history.map(toPartnerAcceptance),
      legalName: a.legalName,
      phoneMasked: maskPhone(a.phone ?? ""),
      otp: {
        pending: pending ? { challengeId: pending.id, channel: pending.channel, destinationMasked: pending.destinationMasked, expiresAt: pending.expiresAt } : null,
        resendAt,
        lockedUntil: lock,
      },
    };
  },

  async requestOtp(a: Astrologer, dto: OtpRequestDto, ctx: RequestCtx): Promise<Result<OtpSendResult>> {
    const check = await checkSignable(a, dto);
    if (!check.ok) return check;
    const current = check.value;
    const repo = getAgreementRepository();
    const now = Date.now();

    // Durable limits (stored with the challenges, so restarts don't reset them).
    const recent = await repo.recentOtps(a.id, new Date(now - 3600_000).toISOString());
    const lock = recent.map((o) => o.lockedUntil).filter((x): x is string => !!x && Date.parse(x) > now).sort().pop();
    if (lock) return fail(AppErrors.rateLimited(`Signing is locked after too many wrong OTPs. Try again in ${Math.ceil((Date.parse(lock) - now) / 60000)} min.`, { reason: "LOCKED", until: lock }));
    const latest = recent[0];
    if (latest && Date.parse(latest.createdAt) + OTP_RESEND_MS > now) {
      return fail(AppErrors.rateLimited(`Wait ${Math.ceil((Date.parse(latest.createdAt) + OTP_RESEND_MS - now) / 1000)} s before asking for a new OTP.`, { reason: "RESEND_WAIT" }));
    }
    if (recent.length >= OTP_MAX_PER_HOUR) {
      const oldest = recent[recent.length - 1];
      return fail(AppErrors.rateLimited(`Too many OTPs. Try again in ${Math.max(1, Math.ceil((Date.parse(oldest.createdAt) + 3600_000 - now) / 60000))} min.`, { reason: "HOURLY_LIMIT" }));
    }

    const code = newOtpCode();
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(now + OTP_TTL_MS).toISOString();
    const name = a.displayName.split(" ")[0] || a.displayName;
    const smsText = `${code} is your OTP to sign the ${BRAND.name} Partner Agreement v${current.version}. Valid 5 min. Do not share it with anyone.`;

    // SMS first (default channel).
    let channel: "sms" | "email" = "sms";
    let destinationMasked = maskPhone(a.phone ?? "");
    let delivered = false;
    const sms: SmsResult = a.phone
      ? await sendSms({ to: a.phone, text: smsText, templateId: env.SMS_OTP_TEMPLATE_ID })
      : { delivered: false, provider: null, reason: "invalid_number" };
    delivered = sms.delivered;

    if (!delivered && strictOtp()) {
      // Production without a working SMS gateway: fall back to the registered email.
      const mailed = await mailSigningOtp(a.email, name, code, current.version);
      if (mailed) { channel = "email"; destinationMasked = maskEmail(a.email); delivered = true; }
    }
    if (!delivered && strictOtp()) {
      logger.error("agreement otp could not be delivered", { astrologerId: a.id, smsReason: sms.reason });
      return fail(AppErrors.internal("We could not send the OTP right now. Try again in a minute or contact support."));
    }

    await repo.closeOpenOtps(a.id, createdAt);
    const ch = await repo.createOtp({
      astrologerId: a.id, agreementId: current.id, contentHash: current.contentHash as string,
      codeHash: hashOtp(otpBinding(a.id, current.id, createdAt), code),
      channel, destinationMasked, delivered, createdAt, expiresAt, attempts: 0, lockedUntil: null, consumedAt: null, ip: ctx.ip,
    }, new Date(now + 2 * 3600_000).toISOString());

    return ok({
      challengeId: ch.id, channel, destinationMasked, expiresAt, delivered,
      resendAt: new Date(now + OTP_RESEND_MS).toISOString(),
      // Only for testing (local, or OTP_DEMO_MODE=true) while no SMS provider is connected.
      ...(!delivered && !strictOtp() ? { devCode: code } : {}),
    });
  },

  async sign(a: Astrologer, dto: SignDto, ctx: RequestCtx): Promise<Result<PartnerAcceptanceView>> {
    const check = await checkSignable(a, dto);
    if (!check.ok) return check;
    const current = check.value;
    const repo = getAgreementRepository();

    const ch = await repo.getOtp(dto.challengeId);
    if (!ch || ch.astrologerId !== a.id || ch.agreementId !== current.id || ch.contentHash !== current.contentHash) {
      return fail(AppErrors.validation("This OTP is not valid. Send a new one.", { reason: "OTP_INVALID" }));
    }
    if (ch.lockedUntil && Date.parse(ch.lockedUntil) > Date.now()) {
      return fail(AppErrors.rateLimited("Signing is locked after too many wrong OTPs. Try again later.", { reason: "LOCKED", until: ch.lockedUntil }));
    }
    if (ch.consumedAt) return fail(AppErrors.validation("This OTP was already used or replaced. Send a new one.", { reason: "OTP_USED" }));
    if (Date.parse(ch.expiresAt) <= Date.now()) return fail(AppErrors.validation("The OTP has expired. Send a new one.", { reason: "OTP_EXPIRED" }));

    const counted = await repo.registerAttempt(ch.id);
    if (!counted) return fail(AppErrors.validation("This OTP is no longer valid. Send a new one.", { reason: "OTP_USED" }));
    if (!otpMatches(otpBinding(ch.astrologerId, ch.agreementId, ch.createdAt), dto.code, ch.codeHash)) {
      const left = MAX_OTP_ATTEMPTS - counted.attempts;
      if (left <= 0) {
        const until = new Date(Date.now() + OTP_LOCK_MS).toISOString();
        await repo.lockOtp(ch.id, until);
        await logOnAstrologer(a.id, `Agreement signing locked after ${MAX_OTP_ATTEMPTS} wrong OTPs`, "System");
        return fail(AppErrors.rateLimited("Too many wrong OTPs. Signing is locked for 10 minutes.", { reason: "LOCKED", until }));
      }
      return fail(AppErrors.validation(`Wrong OTP. ${left} ${left === 1 ? "try" : "tries"} left.`, { reason: "WRONG_OTP", triesLeft: left }));
    }
    const signedAt = nowIso();
    if (!(await repo.consumeOtp(ch.id, signedAt))) return fail(AppErrors.validation("This OTP was already used. Send a new one.", { reason: "OTP_USED" }));

    const prev = (await repo.acceptancesForPartner(a.id))[0]?.fingerprint ?? null;
    const typedName = dto.typedName.trim().replace(/\s+/g, " ");
    const fingerprint = fingerprintOf({ contentHash: current.contentHash as string, astrologerId: a.id, typedName, signedAt, challengeId: ch.id, prevFingerprint: prev });
    const certificateNo = `AU-AGR-${signedAt.slice(0, 4)}-${fingerprint.slice(0, 8).toUpperCase()}`;

    const created = await repo.createAcceptance({
      certificateNo, astrologerId: a.id, agreementId: current.id, version: current.version, contentHash: current.contentHash as string,
      signer: { legalName: a.legalName, displayName: a.displayName, email: a.email, phoneMasked: maskPhone(a.phone ?? "") },
      typedName,
      method: ch.channel === "email" ? "typed_name_email_otp" : "typed_name_sms_otp",
      otp: { challengeId: ch.id, channel: ch.channel, destinationMasked: ch.destinationMasked, delivered: ch.delivered },
      keyPointsAccepted: current.keyPoints.map((k) => k.id),
      signedAt, ip: ctx.ip, ipMasked: maskIp(ctx.ip), userAgent: ctx.userAgent.slice(0, 600), device: deviceLabel(ctx.userAgent),
      evidence: { scrolledToEnd: dto.scrolledToEnd, secondsOnPage: dto.secondsOnPage },
      fingerprint, prevFingerprint: prev,
      voided: false, voidedAt: null, voidedBy: null, voidReason: null, pdf: null,
    });
    if (created === "duplicate") return fail(AppErrors.conflict(`You have already signed v${current.version}`, { reason: "ALREADY_SIGNED" }));

    invalidate();
    await logOnAstrologer(a.id, `Signed partner agreement v${current.version} (${certificateNo})`, a.displayName);
    await audit("create", created.id, `${a.displayName} · v${current.version}`, `${a.displayName} signed partner agreement v${current.version}`, a.displayName);
    // PDF: generate, archive (private S3) and email it. Failures here never undo the signature.
    const stored = await archiveSignedPdf(created, current);
    sendCopyEmail(created, current, stored?.bytes ?? null, false);
    await notifyPartner(a.id, { kind: "agreement", title: `Agreement v${current.version} signed`, body: `Certificate ${certificateNo}. Your signed copy was emailed to you.`, link: "/astrologer/agreement" });
    return ok(toPartnerAcceptance(stored ? { ...created, pdf: stored.record } : created));
  },

  /** Current published text for applicants (public: the terms are not secret). */
  async publicCurrent(): Promise<PartnerAgreementView | null> {
    const v = await cache.wrap("agreements:public-current", 60, () => getAgreementRepository().currentPublished());
    return v ? toPartnerView(v) : null;
  },

  /**
   * Signup check: which version the applicant opened. Returns the consent to
   * store, or an error if a newer version was published meanwhile. This is a
   * "read and understood" record, NOT a signature (signing happens with OTP).
   */
  async signupConsent(seen: { agreementId: string; contentHash: string } | undefined, ctx: RequestCtx): Promise<Result<SignupConsent | null>> {
    const current = await getAgreementRepository().currentPublished();
    if (!current) return ok(null);
    if (!seen) return fail(AppErrors.validation("Open and read the partner agreement first", { reason: "AGREEMENT_NOT_READ", fields: { acceptTerms: "Open and read the partner agreement first" } }));
    if (seen.agreementId !== current.id || seen.contentHash !== current.contentHash) {
      return fail(AppErrors.conflict("The partner agreement was updated. Please open it again.", { reason: "VERSION_CHANGED", fields: { acceptTerms: "The agreement was updated. Open it again." } }));
    }
    return ok({ agreementId: current.id, version: current.version, contentHash: current.contentHash as string, at: nowIso(), ip: ctx.ip, ipMasked: maskIp(ctx.ip), device: deviceLabel(ctx.userAgent) });
  },

  /* ---------------- PDF copies ---------------- */

  /** Partner's own PDF (signed in). */
  async partnerPdf(a: Astrologer, acceptanceId: string): Promise<Result<PdfFile>> {
    const acc = await getAgreementRepository().getAcceptance(acceptanceId);
    if (!acc || acc.astrologerId !== a.id) return fail(AppErrors.notFound("Signed copy not found"));
    return pdfFor(acc);
  },

  /** PDF via the signed link from the email (no login, works for suspended / closed accounts). */
  async linkPdf(acceptanceId: string, token: string): Promise<Result<PdfFile>> {
    const check = verifyCopyToken(acceptanceId, token);
    if (check === "expired") return fail(AppErrors.forbidden("This download link has expired. Ask support to email a new one."));
    if (check !== "ok") return fail(AppErrors.notFound("Signed copy not found"));
    const acc = await getAgreementRepository().getAcceptance(acceptanceId);
    if (!acc) return fail(AppErrors.notFound("Signed copy not found"));
    return pdfFor(acc);
  },

  async adminPdf(acceptanceId: string): Promise<Result<PdfFile>> {
    const acc = await getAgreementRepository().getAcceptance(acceptanceId);
    if (!acc) return fail(AppErrors.notFound("Signature not found"));
    return pdfFor(acc);
  },

  /** Admin: email the signed PDF + a fresh download link to the partner (any account status). */
  async emailCopy(acceptanceId: string, actor: Actor): Promise<Result<{ sentTo: string }>> {
    const repo = getAgreementRepository();
    const acc = await repo.getAcceptance(acceptanceId);
    if (!acc) return fail(AppErrors.notFound("Signature not found"));
    const v = await repo.getVersion(acc.agreementId);
    if (!v) return fail(AppErrors.notFound("Agreement version not found"));
    const file = await pdfFor(acc);
    if (!file.ok) return file;
    // Send to the current email on file (falls back to the email at signing time).
    const partner = await getAstrologerRepository().findById(acc.astrologerId);
    const to = partner?.email || acc.signer.email;
    sendCopyEmail({ ...acc, signer: { ...acc.signer, email: to } }, v, file.value.bytes, true);
    await repo.pushActivity(acc.agreementId, act(actor.name, `Emailed signed copy ${acc.certificateNo} to ${acc.signer.displayName}`));
    await logOnAstrologer(acc.astrologerId, `Signed copy of agreement v${acc.version} emailed by support`, actor.name);
    return ok({ sentTo: to.replace(/^(.).*(@.*)$/, "$1••••$2") });
  },

  async partnerCopy(a: Astrologer, acceptanceId: string): Promise<Result<SignedCopy>> {
    const repo = getAgreementRepository();
    const acc = await repo.getAcceptance(acceptanceId);
    if (!acc || acc.astrologerId !== a.id) return fail(AppErrors.notFound("Signed copy not found"));
    const v = await repo.getVersion(acc.agreementId);
    if (!v) return fail(AppErrors.notFound("Agreement version not found"));
    return ok({ acceptance: toPartnerAcceptance(acc), agreement: toPartnerView(v), verified: verifyCopy(acc, v) });
  },

  /* ---------------- admin: versions ---------------- */

  async list(): Promise<Result<AgreementListItem[]>> {
    const repo = getAgreementRepository();
    const [versions, counts, approved] = await Promise.all([
      repo.listVersions(),
      repo.signedCounts(),
      getAstrologerRepository().findAll({ status: "approved" }),
    ]);
    return ok(versions.map((v) => ({ ...v, signedCount: counts[v.id] ?? 0, targetCount: approved.length })));
  },

  async get(id: string): Promise<Result<AgreementVersion>> {
    const v = await getAgreementRepository().getVersion(id);
    return v ? ok(v) : fail(AppErrors.notFound("Agreement version not found"));
  },

  async createDraft(input: DraftDto | { cloneFrom: string; version?: string }, actor: Actor): Promise<Result<AgreementVersion>> {
    const repo = getAgreementRepository();
    const all = await repo.listVersions();
    let base: DraftDto;
    if ("cloneFrom" in input) {
      const src = all.find((v) => v.id === input.cloneFrom);
      if (!src) return fail(AppErrors.notFound("The version to copy was not found"));
      const start = new Date();
      base = {
        version: input.version ?? nextVersion(all),
        title: src.title,
        changes: [],
        clauses: src.clauses.map((c) => ({ ...c })),
        keyPoints: src.keyPoints.map((k) => ({ ...k })),
        effectiveFrom: start.toISOString(),
        signDeadline: new Date(start.getTime() + 30 * 86400_000).toISOString(),
      };
    } else base = input;

    if (!VERSION_RE.test(base.version)) return fail(AppErrors.validation("Use a version like 3.3"));
    const issue = draftIssue(base);
    if (issue) return fail(AppErrors.validation(issue));
    const created = await repo.createVersion({
      version: base.version, title: base.title, status: "draft", changes: base.changes,
      clauses: withIds(base.clauses, "c") as AgreementClause[], keyPoints: withIds(base.keyPoints, "kp") as AgreementKeyPoint[],
      effectiveFrom: new Date(base.effectiveFrom).toISOString(), signDeadline: new Date(base.signDeadline).toISOString(),
      contentHash: null, publishedAt: null, publishedBy: null, retiredAt: null, createdBy: actor.name,
      activity: [act(actor.name, "cloneFrom" in input ? `Draft created from an earlier version` : "Draft created")],
    });
    if (created === "duplicate") return fail(AppErrors.conflict(`Version ${base.version} already exists`));
    await audit("create", created.id, `v${created.version}`, `Created agreement draft v${created.version}`, actor.name);
    return ok(created);
  },

  async updateDraft(id: string, dto: DraftUpdateDto, actor: Actor): Promise<Result<AgreementVersion>> {
    const repo = getAgreementRepository();
    const v = await repo.getVersion(id);
    if (!v) return fail(AppErrors.notFound("Agreement version not found"));
    if (v.status !== "draft") return fail(AppErrors.conflict("A published version cannot be changed. Create a new version instead."));
    const next = { effectiveFrom: dto.effectiveFrom ?? v.effectiveFrom, signDeadline: dto.signDeadline ?? v.signDeadline };
    const issue = draftIssue(next);
    if (issue) return fail(AppErrors.validation(issue));
    const patch = {
      ...(dto.version !== undefined && { version: dto.version }),
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.changes !== undefined && { changes: dto.changes }),
      ...(dto.clauses !== undefined && { clauses: withIds(dto.clauses, "c") as AgreementClause[] }),
      ...(dto.keyPoints !== undefined && { keyPoints: withIds(dto.keyPoints, "kp") as AgreementKeyPoint[] }),
      ...(dto.effectiveFrom !== undefined && { effectiveFrom: new Date(dto.effectiveFrom).toISOString() }),
      ...(dto.signDeadline !== undefined && { signDeadline: new Date(dto.signDeadline).toISOString() }),
    };
    const updated = await repo.updateDraft(id, patch, act(actor.name, "Draft edited"));
    if (updated === "duplicate") return fail(AppErrors.conflict(`Version ${dto.version} already exists`));
    if (!updated) return fail(AppErrors.conflict("This version was published meanwhile. Reload the page."));
    return ok(updated);
  },

  async deleteDraft(id: string, actor: Actor): Promise<Result<{ id: string }>> {
    const repo = getAgreementRepository();
    const v = await repo.getVersion(id);
    if (!v) return fail(AppErrors.notFound("Agreement version not found"));
    if (v.status !== "draft") return fail(AppErrors.conflict("Only drafts can be deleted. Published versions are kept as legal records."));
    if (!(await repo.deleteDraft(id))) return fail(AppErrors.conflict("This version was published meanwhile. Reload the page."));
    await audit("delete", id, `v${v.version}`, `Deleted agreement draft v${v.version}`, actor.name);
    return ok({ id });
  },

  async publish(id: string, confirmVersion: string, actor: Actor): Promise<Result<AgreementVersion>> {
    const repo = getAgreementRepository();
    const v = await repo.getVersion(id);
    if (!v) return fail(AppErrors.notFound("Agreement version not found"));
    if (v.status !== "draft") return fail(AppErrors.conflict("This version is already published"));
    if (confirmVersion.trim() !== v.version) return fail(AppErrors.validation(`Type ${v.version} to confirm`));
    if (v.title.trim().length < 3) return fail(AppErrors.validation("Add a title"));
    if (v.clauses.length === 0) return fail(AppErrors.validation("Add at least one clause"));
    if (v.clauses.some((c) => c.heading.trim().length < 2 || c.body.trim().length < 10)) return fail(AppErrors.validation("Every clause needs a heading and its text"));
    if (v.keyPoints.length === 0) return fail(AppErrors.validation("Add at least one key point partners must confirm"));
    const issue = draftIssue(v);
    if (issue) return fail(AppErrors.validation(issue));
    if (Date.parse(v.signDeadline) <= Date.now()) return fail(AppErrors.validation("The signing deadline must be in the future"));
    const all = await repo.listVersions();
    const higher = all.find((x) => x.id !== id && x.status !== "draft" && compareVersions(x.version, v.version) >= 0);
    if (higher) return fail(AppErrors.validation(`Version must be higher than v${higher.version}`));

    const publishedAt = nowIso();
    const published = await repo.publish(id, { contentHash: contentHashOf(v), publishedAt, publishedBy: actor.name, activity: act(actor.name, "Published") });
    if (!published) return fail(AppErrors.conflict("This version was published meanwhile. Reload the page."));
    const retired = await repo.retireOlder(id, publishedAt, act(actor.name, `Retired when v${v.version} was published`));
    invalidate();
    // Tell every active partner there is a new version to sign.
    const targets = (await getAstrologerRepository().findAll()).filter((x) => ["applied", "under_review", "approved"].includes(x.status)).map((x) => x.id);
    const { noticeService } = await import("@/modules/partner-notices");
    await noticeService.notifyMany(targets, { kind: "agreement", title: `New partner agreement v${v.version}`, body: `Please review and sign it by ${ist(v.signDeadline)}. After that you cannot go online until it is signed.`, link: "/astrologer/agreement" });
    await audit("status", id, `v${v.version}`, `Published partner agreement v${v.version}${retired ? ` (retired ${retired} older)` : ""}`, actor.name);
    return ok(published);
  },

  /* ---------------- admin: signatures ---------------- */

  async signatures(id: string): Promise<Result<{ agreement: AgreementVersion; rows: SignatureRow[] }>> {
    const repo = getAgreementRepository();
    const v = await repo.getVersion(id);
    if (!v) return fail(AppErrors.notFound("Agreement version not found"));
    const [astrologers, accs, exts] = await Promise.all([getAstrologerRepository().findAll(), repo.acceptancesForAgreement(id), repo.listExtensions(id)]);
    const live = new Map(accs.filter((x) => !x.voided).map((x) => [x.astrologerId, x]));
    const ext = new Map(exts.map((x) => [x.astrologerId, x]));
    const rows: SignatureRow[] = astrologers.map((a) => {
      const s = live.get(a.id);
      return {
        astrologerId: a.id, displayName: a.displayName, legalName: a.legalName, email: a.email, status: a.status,
        signed: Boolean(s), acceptanceId: s?.id ?? null, certificateNo: s?.certificateNo ?? null, signedAt: s?.signedAt ?? null,
        extendedUntil: ext.get(a.id)?.until ?? null,
      };
    });
    rows.sort((x, y) => Number(x.signed) - Number(y.signed) || x.displayName.localeCompare(y.displayName));
    return ok({ agreement: v, rows });
  },

  async remind(id: string, astrologerIds: string[] | undefined, actor: Actor): Promise<Result<{ sent: number }>> {
    const repo = getAgreementRepository();
    const current = await repo.currentPublished();
    if (!current || current.id !== id) return fail(AppErrors.validation("Reminders can only be sent for the current version"));
    const [approved, accs, exts] = await Promise.all([getAstrologerRepository().findAll({ status: "approved" }), repo.acceptancesForAgreement(id), repo.listExtensions(id)]);
    const signed = new Set(accs.filter((x) => !x.voided).map((x) => x.astrologerId));
    const ext = new Map(exts.map((x) => [x.astrologerId, x.until]));
    const pick = astrologerIds ? new Set(astrologerIds) : null;
    const targets = approved.filter((a) => !signed.has(a.id) && (!pick || pick.has(a.id)));
    for (const a of targets) {
      const deadline = (ext.get(a.id) ?? "") > current.signDeadline ? (ext.get(a.id) as string) : current.signDeadline;
      mailReminder(a.email, a.displayName.split(" ")[0] || a.displayName, current.version, ist(deadline), panelUrl("/astrologer/agreement"));
    }
    await repo.pushActivity(id, act(actor.name, `Reminder sent to ${targets.length} partner${targets.length === 1 ? "" : "s"}`));
    return ok({ sent: targets.length });
  },

  async extend(id: string, input: { astrologerId: string; until: string; reason: string }, actor: Actor): Promise<Result<AgreementExtension>> {
    if (input.reason.trim().length < 5) return fail(AppErrors.validation("Give a reason (at least 5 characters)"));
    const repo = getAgreementRepository();
    const v = await repo.getVersion(id);
    if (!v || v.status !== "published") return fail(AppErrors.validation("Extensions can only be given on the current version"));
    const a = await getAstrologerRepository().findById(input.astrologerId);
    if (!a) return fail(AppErrors.notFound("Astrologer not found"));
    if (await repo.activeAcceptance(a.id, id)) return fail(AppErrors.conflict(`${a.displayName} has already signed this version`));
    const until = Date.parse(input.until);
    if (until <= Date.now()) return fail(AppErrors.validation("Pick a date in the future"));
    if (until <= Date.parse(v.signDeadline)) return fail(AppErrors.validation("The new date must be after the current deadline"));
    if (until > Date.parse(v.signDeadline) + MAX_EXTENSION_DAYS * 86400_000) return fail(AppErrors.validation(`An extension can be at most ${MAX_EXTENSION_DAYS} days`));
    const e = await repo.upsertExtension({ agreementId: id, astrologerId: a.id, until: new Date(until).toISOString(), reason: input.reason.trim(), grantedBy: actor.name, grantedAt: nowIso() });
    invalidate();
    await repo.pushActivity(id, act(actor.name, `Extended deadline for ${a.displayName} to ${ist(e.until)}`, input.reason.trim()));
    await logOnAstrologer(a.id, `Agreement v${v.version} deadline extended to ${ist(e.until)}: ${input.reason.trim()}`, actor.name);
    await audit("update", id, `v${v.version}`, `Extended agreement deadline for ${a.displayName}`, actor.name);
    mailExtended(a.email, a.displayName.split(" ")[0] || a.displayName, v.version, ist(e.until));
    await notifyPartner(a.id, { kind: "agreement", title: "More time to sign the agreement", body: `You can sign partner agreement v${v.version} until ${ist(e.until)}.`, link: "/astrologer/agreement" });
    return ok(e);
  },

  async removeExtension(id: string, astrologerId: string, actor: Actor): Promise<Result<{ removed: boolean }>> {
    const repo = getAgreementRepository();
    const v = await repo.getVersion(id);
    if (!v) return fail(AppErrors.notFound("Agreement version not found"));
    const removed = await repo.deleteExtension(id, astrologerId);
    if (!removed) return fail(AppErrors.notFound("No extension to remove"));
    invalidate();
    const a = await getAstrologerRepository().findById(astrologerId);
    await repo.pushActivity(id, act(actor.name, `Removed deadline extension for ${a?.displayName ?? astrologerId}`));
    if (a) await logOnAstrologer(a.id, `Agreement v${v.version} deadline extension removed`, actor.name);
    return ok({ removed: true });
  },

  /** Admin: every signature of one partner (full evidence) + the gate. */
  async forAstrologer(astrologerId: string): Promise<Result<{ acceptances: AgreementAcceptance[]; gate: AgreementGateInfo; signupConsent: SignupConsent | null }>> {
    const a = await getAstrologerRepository().findById(astrologerId);
    if (!a) return fail(AppErrors.notFound("Astrologer not found"));
    const [acceptances, gate] = await Promise.all([getAgreementRepository().acceptancesForPartner(a.id), computeGate(a)]);
    return ok({ acceptances, gate, signupConsent: a.signupConsent ?? null });
  },

  async voidAcceptance(acceptanceId: string, reason: string, actor: Actor): Promise<Result<AgreementAcceptance>> {
    if (reason.trim().length < 10) return fail(AppErrors.validation("Give a clear reason (at least 10 characters)"));
    const repo = getAgreementRepository();
    const acc = await repo.getAcceptance(acceptanceId);
    if (!acc) return fail(AppErrors.notFound("Signature not found"));
    if (acc.voided) return fail(AppErrors.conflict("This signature is already void"));
    const voided = await repo.voidAcceptance(acceptanceId, { voidedAt: nowIso(), voidedBy: actor.name, voidReason: reason.trim() });
    if (!voided) return fail(AppErrors.conflict("This signature was changed meanwhile. Reload the page."));
    invalidate();
    await repo.pushActivity(acc.agreementId, act(actor.name, `Voided signature ${acc.certificateNo} of ${acc.signer.displayName}`, reason.trim()));
    await logOnAstrologer(acc.astrologerId, `Agreement v${acc.version} signature voided: ${reason.trim()}`, actor.name);
    await audit("status", acc.id, acc.certificateNo, `Voided agreement signature ${acc.certificateNo} (${acc.signer.displayName})`, actor.name);
    await notifyPartner(acc.astrologerId, { kind: "agreement", title: `Please sign agreement v${acc.version} again`, body: `Your signature was cancelled by our team: ${reason.trim()}`, link: "/astrologer/agreement" });
    const a = await getAstrologerRepository().findById(acc.astrologerId);
    if (a) mailVoided(a.email, a.displayName.split(" ")[0] || a.displayName, acc.version, reason.trim(), panelUrl("/astrologer/agreement"));
    return ok(voided);
  },

  async adminCopy(acceptanceId: string): Promise<Result<SignedCopy<AgreementAcceptance>>> {
    const repo = getAgreementRepository();
    const acc = await repo.getAcceptance(acceptanceId);
    if (!acc) return fail(AppErrors.notFound("Signature not found"));
    const v = await repo.getVersion(acc.agreementId);
    if (!v) return fail(AppErrors.notFound("Agreement version not found"));
    return ok({ acceptance: acc, agreement: toPartnerView(v), verified: verifyCopy(acc, v) });
  },
};
