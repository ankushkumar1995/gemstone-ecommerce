import "server-only";

/**
 * Partner agreements — Mongoose models.
 *
 *  • partner_agreements            — versions (immutable once published)
 *  • partner_agreement_acceptances — signatures (append-only; unique per
 *                                    partner + version while not voided)
 *  • partner_agreement_otps        — OTP challenges (code hash only; TTL)
 *  • partner_agreement_extensions  — per-partner deadline extensions
 */

import { Schema, deleteModel, model, models, type Model } from "mongoose";

const ClauseSchema = new Schema(
  { id: { type: String, required: true }, heading: { type: String, required: true, maxlength: 160 }, body: { type: String, required: true, maxlength: 8000 } },
  { _id: false },
);
const KeyPointSchema = new Schema({ id: { type: String, required: true }, text: { type: String, required: true, maxlength: 240 } }, { _id: false });
const ActivitySchema = new Schema(
  { at: { type: Date, required: true }, actor: { type: String, required: true }, action: { type: String, required: true }, note: { type: String } },
  { _id: false },
);

const AgreementSchema = new Schema(
  {
    version: { type: String, required: true, trim: true, maxlength: 20 },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    status: { type: String, required: true, enum: ["draft", "published", "retired"], default: "draft" },
    changes: { type: [String], default: [] },
    clauses: { type: [ClauseSchema], default: [] },
    keyPoints: { type: [KeyPointSchema], default: [] },
    effectiveFrom: { type: Date, required: true },
    signDeadline: { type: Date, required: true },
    contentHash: { type: String, default: null },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: String, default: null },
    retiredAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
    activity: { type: [ActivitySchema], default: [] },
  },
  { collection: "partner_agreements", timestamps: true, versionKey: false },
);
AgreementSchema.index({ version: 1 }, { unique: true });
AgreementSchema.index({ status: 1, publishedAt: -1 });

const AcceptanceSchema = new Schema(
  {
    certificateNo: { type: String, required: true },
    astrologerId: { type: String, required: true },
    agreementId: { type: String, required: true },
    version: { type: String, required: true },
    contentHash: { type: String, required: true },
    signer: {
      legalName: { type: String, required: true },
      displayName: { type: String, required: true },
      email: { type: String, required: true },
      phoneMasked: { type: String, default: "" },
    },
    typedName: { type: String, required: true, maxlength: 120 },
    method: { type: String, required: true, enum: ["typed_name_sms_otp", "typed_name_email_otp"] },
    otp: {
      challengeId: { type: String, required: true },
      channel: { type: String, required: true, enum: ["sms", "email"] },
      destinationMasked: { type: String, required: true },
      delivered: { type: Boolean, required: true },
    },
    keyPointsAccepted: { type: [String], default: [] },
    signedAt: { type: Date, required: true },
    ip: { type: String, default: "" },
    ipMasked: { type: String, default: "" },
    userAgent: { type: String, default: "", maxlength: 600 },
    device: { type: String, default: "" },
    evidence: {
      scrolledToEnd: { type: Boolean, default: false },
      secondsOnPage: { type: Number, default: 0 },
    },
    fingerprint: { type: String, required: true },
    prevFingerprint: { type: String, default: null },
    voided: { type: Boolean, default: false },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: String, default: null },
    voidReason: { type: String, default: null },
    pdf: {
      type: new Schema({ key: String, sha256: String, bytes: Number, storedAt: Date }, { _id: false }),
      default: null,
    },
  },
  { collection: "partner_agreement_acceptances", timestamps: false, versionKey: false },
);
// One live signature per partner per version. A voided one no longer counts,
// so the partner can sign that version again.
AcceptanceSchema.index({ astrologerId: 1, agreementId: 1 }, { unique: true, partialFilterExpression: { voided: false } });
AcceptanceSchema.index({ certificateNo: 1 }, { unique: true });
AcceptanceSchema.index({ agreementId: 1, signedAt: -1 });
AcceptanceSchema.index({ astrologerId: 1, signedAt: -1 });

const OtpSchema = new Schema(
  {
    astrologerId: { type: String, required: true },
    agreementId: { type: String, required: true },
    contentHash: { type: String, required: true },
    codeHash: { type: String, required: true },
    channel: { type: String, required: true, enum: ["sms", "email"] },
    destinationMasked: { type: String, required: true },
    delivered: { type: Boolean, required: true },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    consumedAt: { type: Date, default: null },
    ip: { type: String, default: "" },
    /** Kept a while after expiry so hourly send limits and locks still count. */
    purgeAt: { type: Date, required: true },
  },
  { collection: "partner_agreement_otps", timestamps: false, versionKey: false },
);
OtpSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
OtpSchema.index({ astrologerId: 1, createdAt: -1 });

const ExtensionSchema = new Schema(
  {
    agreementId: { type: String, required: true },
    astrologerId: { type: String, required: true },
    until: { type: Date, required: true },
    reason: { type: String, required: true, maxlength: 300 },
    grantedBy: { type: String, required: true },
    grantedAt: { type: Date, required: true },
  },
  { collection: "partner_agreement_extensions", timestamps: false, versionKey: false },
);
ExtensionSchema.index({ agreementId: 1, astrologerId: 1 }, { unique: true });

/* Dev hot reload: recompile so schema changes apply without a restart. Production compiles once. */
if (process.env.NODE_ENV !== "production") {
  for (const n of ["PartnerAgreement", "PartnerAgreementAcceptance", "PartnerAgreementOtp", "PartnerAgreementExtension"]) if (models[n]) deleteModel(n);
}
export const AgreementModel: Model<Record<string, unknown>> =
  (models.PartnerAgreement as Model<Record<string, unknown>>) ?? model("PartnerAgreement", AgreementSchema);
export const AcceptanceModel: Model<Record<string, unknown>> =
  (models.PartnerAgreementAcceptance as Model<Record<string, unknown>>) ?? model("PartnerAgreementAcceptance", AcceptanceSchema);
export const OtpModel: Model<Record<string, unknown>> =
  (models.PartnerAgreementOtp as Model<Record<string, unknown>>) ?? model("PartnerAgreementOtp", OtpSchema);
export const ExtensionModel: Model<Record<string, unknown>> =
  (models.PartnerAgreementExtension as Model<Record<string, unknown>>) ?? model("PartnerAgreementExtension", ExtensionSchema);
