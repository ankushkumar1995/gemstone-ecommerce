/**
 * Live sessions (astrologer goes live for everyone).
 *
 * Lifecycle
 *   scheduled ──start──▶ live ──end / time limit / astrologer gone──▶ ended
 *       └── cancel ──▶ cancelled
 *
 * What works today (no native video yet): the live room with real viewers,
 * comments, likes, paid gifts from the wallet and a free "ask on live" queue
 * the astrologer answers one by one. The room has a `stream` slot that a
 * video provider fills later; until then viewers see the astrologer's photo.
 *
 * Realtime is long-poll (same as chat): every change that matters bumps
 * `seq` (a new event) or `version` (pin, settings, queue, end).
 */

export type LiveStatus = "scheduled" | "live" | "ended" | "cancelled";
export type LiveEndReason = "astrologer" | "time_limit" | "astrologer_left" | "admin";
export type LiveEventKind = "comment" | "gift" | "join" | "system" | "superchat";

export interface LiveGift { id: string; name: string; emoji: string; price: number }

/** Topics a live can be tagged with (feed chips). Fixed list so the app and panel always agree. */
export const LIVE_TAGS = ["Career", "Love", "Marriage", "Finance", "Health", "Family", "Remedies", "Kundli"] as const;
export type LiveTag = (typeof LIVE_TAGS)[number];

export interface LiveSession {
  id: string;
  liveNumber: string;
  astrologerId: string;
  astrologer: { name: string; photo: string | null; slug: string };
  title: string;
  topic: string;
  status: LiveStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  endReason: LiveEndReason | null;
  /** Set to the astrologer id while live: unique index = one live per astrologer. */
  openAstro: string | null;
  lastBeatAt: string | null;
  commissionPct: number;
  seq: number;
  version: number;
  likes: number;
  giftCount: number;
  giftsPaise: number;
  earningPaise: number;
  commentCount: number;
  peakViewers: number;
  uniqueViewers: number;
  pinned: { seq: number; name: string; text: string } | null;
  answering: { queueId: string; name: string; question: string; paidPaise?: number } | null;
  /** The latest Super Chat, highlighted on screen until `until`. */
  superPin: { seq: number; name: string; text: string; amount: number; until: string } | null;
  superChatCount: number;
  /** Super Chats the astrologer kept (answered), before commission. */
  superChatPaise: number;
  reminderCount: number;
  commentsOff: boolean;
  slowSec: number;
  queueOpen: boolean;
  muted: string[];
  hiddenSeqs: number[];
  /** Live video / audio (LiveKit → HLS). Null while the camera and mic are off. Server-only state. */
  stream: LiveStream | null;
  /** Seconds the HLS recorder ran for this live (LiveKit bills these minutes). */
  videoSeconds: number;
  /** Topic chips (LIVE_TAGS). */
  tags: string[];
  /** Astrologer's languages when the live was made (feed ranking by the viewer's language). */
  languages: string[];
  /** Pinned to the top of the feed by the admin. */
  featured: boolean;
  featuredAt: string | null;
  /** Viewers who joined the astrologer's 1-to-1 chat line from this live. */
  chatLeads: number;
  createdAt: string;
}

/**
 * The astrologer is publishing (camera + mic, or mic only). The HLS recorder
 * ("egress", billed per minute) runs only while viewers are watching when the
 * admin setting `live.video.waitForViewers` is on; each run writes its own folder.
 */
export interface LiveStream {
  provider: "livekit-hls";
  kind: "video" | "audio";
  orientation: "portrait" | "landscape";
  /** When the astrologer turned it on. */
  startedAt: string;
  /** Recorder for viewers; null while nobody watches. */
  egressId: string | null;
  egressStartedAt: string | null;
  /** Lock while a start call is in flight. */
  startingAt: string | null;
  /** Recorder runs so far (folder r<run>). */
  run: number;
  /** HLS playlist of the running recorder. */
  playbackUrl: string | null;
  /** Last time any viewer polled this live. */
  demandAt: string | null;
  /** Failed starts in a row, for the retry backoff. */
  fails: number;
  failedAt: string | null;
}

export interface LiveEvent {
  seq: number;
  kind: LiveEventKind;
  by: "customer" | "astrologer" | "system";
  name: string;
  text: string;
  /** `count` = combo size (×5, ×10); `price` is for one. */
  gift?: { id: string; name: string; emoji: string; price: number; count?: number };
  /** Super Chat: amount paid (₹). */
  amount?: number;
  at: string;
  mine?: boolean;
}

export type LiveQueueStatus = "waiting" | "answering" | "answered" | "skipped" | "left";
export interface LiveQueueItem {
  id: string; name: string; question: string; status: LiveQueueStatus; createdAt: string;
  /** Super Chat paid for priority (paise, 0 = free question). */
  paidPaise: number;
  /** earned = kept by the astrologer (answered), refunded = money back to the customer. */
  paidState: "none" | "held" | "earned" | "refunded";
}
