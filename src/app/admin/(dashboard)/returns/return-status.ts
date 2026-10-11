import type { ReturnStatus, ReturnReason } from "@/modules/returns";

type Tone = "muted" | "gold" | "green" | "blue" | "rose";

export const RETURN_STATUS_META: Record<ReturnStatus, { label: string; tone: Tone }> = {
  requested: { label: "Requested", tone: "gold" },
  approved: { label: "Approved", tone: "blue" },
  received: { label: "Received", tone: "blue" },
  refunded: { label: "Refunded", tone: "green" },
  rejected: { label: "Rejected", tone: "rose" },
};

export const NEXT_RETURN_STATUSES: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["received", "rejected"],
  received: ["refunded", "rejected"],
  refunded: [],
  rejected: [],
};

export const REASON_LABELS: Record<ReturnReason, string> = {
  damaged: "Damaged",
  not_as_described: "Not as described",
  wrong_item: "Wrong item",
  changed_mind: "Changed mind",
  quality: "Quality issue",
  other: "Other",
};
