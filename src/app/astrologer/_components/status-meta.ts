import type { AstrologerStatus, KycDocStatus, KycDocType } from "@/modules/astrologers/astrologer.types";

type Tone = "muted" | "gold" | "green" | "blue" | "rose";

export const STATUS_META: Record<AstrologerStatus, { label: string; tone: Tone; help: string }> = {
  applied: { label: "Application started", tone: "blue", help: "Upload your KYC documents so we can review your profile." },
  under_review: { label: "Under review", tone: "gold", help: "Our team is reviewing your profile and documents. This usually takes 1-2 working days." },
  approved: { label: "Approved", tone: "green", help: "You are live on Astrounkle. Go online to start receiving consultations." },
  rejected: { label: "Changes needed", tone: "rose", help: "Fix the points below and submit your profile for review again." },
  suspended: { label: "Suspended", tone: "rose", help: "Your account is suspended. Contact support for help." },
  deactivated: { label: "Deactivated", tone: "muted", help: "Your profile is hidden. Reactivate it to start again." },
};

export const KYC_LABEL: Record<KycDocType, { label: string; help: string; needsNumber?: "pan" | "aadhaar"; required: boolean }> = {
  pan: { label: "PAN card", help: "Needed for payouts and tax records.", needsNumber: "pan", required: true },
  aadhaar: { label: "Aadhaar", help: "Identity check. Only the last 4 digits are kept.", needsNumber: "aadhaar", required: true },
  bank_proof: { label: "Bank proof", help: "Cancelled cheque or bank statement showing your name and account.", required: true },
  photo_id: { label: "Photo ID (optional)", help: "Passport, voter ID or driving licence.", required: false },
  certificate: { label: "Certificate (optional)", help: "Astrology course or degree certificate. Shown as a trust signal.", required: false },
};

export const KYC_STATUS_META: Record<KycDocStatus, { label: string; tone: Tone }> = {
  pending: { label: "In review", tone: "gold" },
  verified: { label: "Verified", tone: "green" },
  rejected: { label: "Rejected", tone: "rose" },
};
