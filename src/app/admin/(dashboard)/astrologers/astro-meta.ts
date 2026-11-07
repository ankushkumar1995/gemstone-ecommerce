import type { AstrologerStatus, KycDocStatus, KycDocType } from "@/modules/astrologers/astrologer.types";

type Tone = "muted" | "gold" | "green" | "blue" | "rose";

export const A_STATUS: Record<AstrologerStatus, { label: string; tone: Tone }> = {
  applied: { label: "Applied", tone: "blue" },
  under_review: { label: "Under review", tone: "gold" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "rose" },
  suspended: { label: "Suspended", tone: "rose" },
  deactivated: { label: "Deactivated", tone: "muted" },
};

/** Admin actions available from each status (mirrors the service TRANSITIONS). */
export const A_NEXT: Record<AstrologerStatus, { to: AstrologerStatus; label: string; needsReason?: boolean; danger?: boolean }[]> = {
  applied: [{ to: "under_review", label: "Start review" }, { to: "approved", label: "Approve" }, { to: "rejected", label: "Reject", needsReason: true, danger: true }],
  under_review: [{ to: "approved", label: "Approve" }, { to: "rejected", label: "Reject", needsReason: true, danger: true }],
  approved: [{ to: "suspended", label: "Suspend", needsReason: true, danger: true }, { to: "deactivated", label: "Deactivate", danger: true }],
  rejected: [{ to: "under_review", label: "Re-open review" }],
  suspended: [{ to: "approved", label: "Reinstate" }, { to: "deactivated", label: "Deactivate", danger: true }],
  deactivated: [{ to: "approved", label: "Reactivate" }, { to: "under_review", label: "Send to review" }],
};

export const KYC_NAMES: Record<KycDocType, string> = { pan: "PAN", aadhaar: "Aadhaar", photo_id: "Photo ID", certificate: "Certificate", bank_proof: "Bank proof" };
export const KYC_TONE: Record<KycDocStatus, Tone> = { pending: "gold", verified: "green", rejected: "rose" };
