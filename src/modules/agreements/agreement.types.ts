/**
 * Partner agreements — types (client-safe: no server imports).
 *
 * Three records:
 *  • AgreementVersion   — admin-authored text. Immutable once published.
 *  • AgreementAcceptance — one signature. Append-only; never edited or deleted
 *                          (an admin can only mark it void, with a reason).
 *  • OtpChallenge       — one OTP sent for signing (hash only, never the code).
 * Plus AgreementExtension — a per-partner deadline extension granted by admin.
 */

export const AGREEMENT_STATUSES = ["draft", "published", "retired"] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

export interface AgreementClause {
  id: string;
  heading: string;
  body: string;
}

/** A statement the partner must tick before signing. */
export interface AgreementKeyPoint {
  id: string;
  text: string;
}

export interface AgreementActivity {
  at: string; // ISO
  actor: string;
  action: string;
  note?: string;
}

export interface AgreementVersion {
  id: string;
  /** e.g. "3.2". Unique; must be higher than every published version. */
  version: string;
  title: string;
  status: AgreementStatus;
  /** "What changed in this version" bullets shown before signing. */
  changes: string[];
  clauses: AgreementClause[];
  keyPoints: AgreementKeyPoint[];
  effectiveFrom: string; // ISO
  /** After this, partners who have not signed cannot go online. */
  signDeadline: string; // ISO
  /** SHA-256 of the canonical text, fixed at publish. Null while draft. */
  contentHash: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  activity: AgreementActivity[];
}

export type OtpChannel = "sms" | "email";
export type SignMethod = "typed_name_sms_otp" | "typed_name_email_otp";

export interface AgreementAcceptance {
  id: string;
  /** Human reference printed on the certificate, e.g. AU-AGR-2026-7F3K9QAB. */
  certificateNo: string;
  astrologerId: string;
  agreementId: string;
  version: string;
  /** Hash of the exact text that was signed. */
  contentHash: string;
  /** Snapshot of the signer at signing time (later profile edits do not change it). */
  signer: { legalName: string; displayName: string; email: string; phoneMasked: string };
  typedName: string;
  method: SignMethod;
  otp: {
    challengeId: string;
    channel: OtpChannel;
    destinationMasked: string;
    /** False only in test mode, when no SMS/email provider was connected. */
    delivered: boolean;
  };
  keyPointsAccepted: string[];
  signedAt: string; // ISO, server time
  /** Full IP: admin-only. Partners see `ipMasked`. */
  ip: string;
  ipMasked: string;
  userAgent: string;
  device: string;
  /** Client-reported reading evidence (supporting, not security). */
  evidence: { scrolledToEnd: boolean; secondsOnPage: number };
  /** SHA-256(contentHash|astrologerId|typedName|signedAt|challengeId|prevFingerprint). */
  fingerprint: string;
  /** Fingerprint of this partner's previous signature (tamper-evident chain). */
  prevFingerprint: string | null;
  voided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  /** Archived PDF made at signing time (private S3). Null if storage was unavailable. */
  pdf: { key: string; sha256: string; bytes: number; storedAt: string } | null;
}

export interface AgreementExtension {
  id: string;
  agreementId: string;
  astrologerId: string;
  until: string; // ISO
  reason: string;
  grantedBy: string;
  grantedAt: string;
}

export interface OtpChallenge {
  id: string;
  astrologerId: string;
  agreementId: string;
  contentHash: string;
  codeHash: string;
  channel: OtpChannel;
  destinationMasked: string;
  delivered: boolean;
  createdAt: string;
  expiresAt: string;
  attempts: number;
  lockedUntil: string | null;
  consumedAt: string | null;
  ip: string;
}

/* ------------------------------------------------------------------ *
 * API views
 * ------------------------------------------------------------------ */

/** What a partner sees of a version (no admin activity). */
export type PartnerAgreementView = Omit<AgreementVersion, "activity" | "createdBy" | "publishedBy">;

/** What a partner sees of their own signature (no full IP / user agent). */
export type PartnerAcceptanceView = Omit<AgreementAcceptance, "ip" | "userAgent" | "voidedBy">;

/**
 * Gate for going online:
 *  • none    — nothing to do (signed, or no agreement published)
 *  • pending — needs signing, but can still go online until the deadline
 *  • blocked — cannot go online until signed (deadline passed, or a new
 *              partner who has never signed)
 */
export type AgreementGate = "none" | "pending" | "blocked";

export interface AgreementGateInfo {
  gate: AgreementGate;
  version: string | null;
  agreementId: string | null;
  /** Deadline incl. any personal extension. */
  deadline: string | null;
  extendedUntil: string | null;
  signed: boolean;
  /** Why it is blocked (shown to the partner). */
  reason: string | null;
}

export interface PartnerAgreementState extends AgreementGateInfo {
  current: PartnerAgreementView | null;
  signature: PartnerAcceptanceView | null;
  history: PartnerAcceptanceView[];
  legalName: string;
  /** Where the OTP goes, masked. */
  phoneMasked: string;
  otp: {
    pending: { challengeId: string; channel: OtpChannel; destinationMasked: string; expiresAt: string } | null;
    resendAt: string | null;
    lockedUntil: string | null;
  };
}

export interface OtpSendResult {
  challengeId: string;
  channel: OtpChannel;
  destinationMasked: string;
  expiresAt: string;
  resendAt: string;
  delivered: boolean;
  /** Only in non-production when no SMS/email provider is connected. */
  devCode?: string;
}

/** One row of the admin "who signed" list. */
export interface SignatureRow {
  astrologerId: string;
  displayName: string;
  legalName: string;
  email: string;
  status: string;
  signed: boolean;
  acceptanceId: string | null;
  certificateNo: string | null;
  signedAt: string | null;
  extendedUntil: string | null;
}

/** Admin version list item with signing progress. */
export interface AgreementListItem extends AgreementVersion {
  signedCount: number;
  /** Approved partners who should sign this version. */
  targetCount: number;
}

/** A signed copy: the signature plus the exact version text it covers. */
export interface SignedCopy<A = PartnerAcceptanceView> {
  acceptance: A;
  agreement: PartnerAgreementView;
  /** Recomputed now: does the stored text still match the signed hash? */
  verified: { textIntact: boolean; fingerprintIntact: boolean };
}
