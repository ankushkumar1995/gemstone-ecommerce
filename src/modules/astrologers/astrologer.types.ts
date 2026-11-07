/**
 * Astrologers domain — types.
 *
 * An astrologer is a third kind of account (alongside admin users and
 * customers) with its own login, profile, KYC, presence and earnings.
 *
 * Lifecycle (see TRANSITIONS in the service):
 *   applied → under_review → approved
 *                ↘ rejected            ↘ suspended → approved
 *   approved → deactivated (self or admin) → under_review (re-apply)
 *
 * Only `approved` astrologers appear on the storefront and can go online.
 * Secrets (password hash, refresh hash, full bank/PAN) never leave the server;
 * they are stored on the model with `select: false` and are not part of these
 * types except through the explicit masked views below.
 */

export type AstrologerStatus = "applied" | "under_review" | "approved" | "rejected" | "suspended" | "deactivated";

export const ASTROLOGER_STATUSES: AstrologerStatus[] = ["applied", "under_review", "approved", "rejected", "suspended", "deactivated"];

/** Consultation channels an astrologer can offer. */
export type Channel = "chat" | "call" | "video";
export const CHANNELS: Channel[] = ["chat", "call", "video"];

/** Admin-assigned highlight badges (same set as the mobile app). */
export type AstroBadge = "vip" | "trending" | "topRated" | "rising" | "mostBooked";
export const ASTRO_BADGES: AstroBadge[] = ["vip", "trending", "topRated", "rising", "mostBooked"];

export const EXPERTISE_OPTIONS = [
  "Vedic", "KP Astrology", "Lal Kitab", "Tarot", "Numerology", "Vastu", "Palmistry", "Prashna",
  "Nadi", "Face Reading", "Western", "Gemology", "Muhurat", "Kundli Milan", "Reiki", "Psychic",
] as const;
export const CATEGORY_OPTIONS = [
  "Love", "Marriage", "Career", "Business", "Finance", "Health", "Education", "Family", "Legal", "Foreign Travel", "Child", "Property",
] as const;
export const LANGUAGE_OPTIONS = [
  "Hindi", "English", "Punjabi", "Marathi", "Gujarati", "Bengali", "Tamil", "Telugu", "Kannada", "Malayalam", "Odia", "Sanskrit", "Bhojpuri", "Urdu",
] as const;

export type KycDocType = "pan" | "aadhaar" | "photo_id" | "certificate" | "bank_proof";
export const KYC_DOC_TYPES: KycDocType[] = ["pan", "aadhaar", "photo_id", "certificate", "bank_proof"];
/** Documents that must be verified before an astrologer can be approved. */
export const REQUIRED_KYC: KycDocType[] = ["pan", "aadhaar", "bank_proof"];
export type KycDocStatus = "pending" | "verified" | "rejected";

export interface KycDoc {
  type: KycDocType;
  /** Private S3 key (never a public URL). Optional when S3 is not configured. */
  fileKey?: string;
  fileName?: string;
  /** Masked document number (e.g. "XXXXX1234X", "XXXX XXXX 4821"). */
  numberMasked?: string;
  status: KycDocStatus;
  note?: string;
  uploadedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

/** Payout destination as shown in the UI (account number masked). */
export interface PayoutAccountView {
  method: "bank" | "upi";
  accountHolder?: string;
  accountNumberMasked?: string;
  ifsc?: string;
  bankName?: string;
  upiId?: string;
  verified: boolean;
}

/** Weekly working hours, local to `timezone`. */
export interface AvailabilitySlot {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface AstrologerRates {
  chat: number; // ₹ per minute (whole rupees)
  call: number;
  video: number;
}

export interface Presence {
  online: boolean;
  channels: Record<Channel, boolean>;
  /** Live session id while busy. */
  busyWith?: string;
  lastHeartbeatAt?: string;
  onlineSince?: string;
}

export interface AstrologerStats {
  rating: number; // 0..5
  reviewCount: number;
  totalSessions: number;
  totalMinutes: number;
  missedRequests: number;
  /** Consecutive missed requests (resets on accept); drives auto-offline. */
  missedStreak: number;
  repeatCustomers: number;
}

export interface AstrologerActivity {
  id: string;
  at: string;
  type: "created" | "status" | "profile" | "kyc" | "presence" | "note" | "admin";
  message: string;
  actor?: string;
}

/** Public-profile fields an approved astrologer may change only through review. */
export interface PendingProfileChanges {
  displayName?: string;
  photo?: string;
  shortBio?: string;
  bio?: string;
  submittedAt: string;
}

export interface Astrologer {
  id: string;
  slug: string;
  /** Name shown to customers, e.g. "Acharya Rohan Ji". */
  displayName: string;
  /** Legal name (KYC / payouts). Admin-only. */
  legalName: string;
  email: string;
  phone: string;
  gender?: "male" | "female" | "other";
  city?: string;
  state?: string;
  photo?: string;
  shortBio?: string;
  bio?: string;
  languages: string[];
  expertise: string[];
  categories: string[];
  experienceYears: number;
  education?: string;
  certifications?: string;
  rates: AstrologerRates;
  availability: AvailabilitySlot[];
  timezone: string;

  status: AstrologerStatus;
  statusReason?: string;
  statusChangedAt?: string;
  appliedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  source: "self" | "invite";

  kyc: KycDoc[];
  payout?: PayoutAccountView;

  presence: Presence;
  stats: AstrologerStats;

  /** Commission override in % taken by the platform. Null = use program default. */
  commissionPct?: number | null;
  /** Upper ₹/min limit for this astrologer (null = program default). */
  maxRate?: number | null;
  featured: boolean;
  sortWeight: number;
  badges: AstroBadge[];
  hidden: boolean;

  pendingChanges?: PendingProfileChanges;
  adminNotes?: string;
  mustChangePassword: boolean;
  lastLoginAt?: string;

  activity: AstrologerActivity[];
  createdAt: string;
  updatedAt: string;
}

/** What the storefront (and mobile app) may see. No contact, legal or KYC data. */
export interface PublicAstrologer {
  id: string;
  slug: string;
  displayName: string;
  gender?: "male" | "female" | "other";
  photo?: string;
  shortBio?: string;
  bio?: string;
  languages: string[];
  expertise: string[];
  categories: string[];
  experienceYears: number;
  education?: string;
  rates: AstrologerRates;
  availability: AvailabilitySlot[];
  timezone: string;
  online: boolean;
  busy: boolean;
  channels: Record<Channel, boolean>;
  rating: number;
  reviewCount: number;
  totalSessions: number;
  totalMinutes: number;
  verified: boolean;
  featured: boolean;
  badges: AstroBadge[];
}

/** The astrologer's own view of their account (no admin-only fields). */
export type SelfAstrologer = Omit<Astrologer, "adminNotes" | "sortWeight" | "hidden" | "commissionPct" | "maxRate"> & {
  effectiveCommissionPct: number;
  effectiveMaxRate: number;
};

export interface AstrologerListFilter {
  status?: AstrologerStatus | AstrologerStatus[];
  q?: string;
}

export interface PublicListFilter {
  q?: string;
  expertise?: string;
  category?: string;
  language?: string;
  gender?: string;
  online?: boolean;
  channel?: Channel;
  maxRate?: number;
  sort?: "recommended" | "rating" | "experience" | "price_low" | "price_high" | "sessions";
  page?: number;
  pageSize?: number;
}
