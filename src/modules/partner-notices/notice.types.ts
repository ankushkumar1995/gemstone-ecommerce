/** Partner notifications + admin announcements — types (client-safe). */

export const NOTICE_KINDS = ["kyc", "status", "profile", "agreement", "announcement", "system"] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

export interface PartnerNotification {
  id: string;
  astrologerId: string;
  kind: NoticeKind;
  title: string;
  body: string;
  /** In-panel link, e.g. /astrologer/kyc */
  link?: string;
  announcementId?: string;
  readAt: string | null;
  createdAt: string;
}

export type AnnouncementAudience = "all" | "approved";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  pinned: boolean;
  status: "published" | "archived";
  createdBy: string;
  createdAt: string;
  archivedAt: string | null;
  /** Fan-out size (partners who got it). */
  sentTo: number;
}

/** Admin list item. */
export interface AnnouncementWithStats extends Announcement {
  readCount: number;
}
