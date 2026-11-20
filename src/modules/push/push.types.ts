/**
 * Push notifications (customer app, Expo Push Service → FCM / APNs).
 *
 * Pipeline (outbox pattern)
 *   1. A domain event (live started, chat accepted, order shipped…) calls
 *      `pushService.queue()`. That writes ONE row per customer with a unique
 *      `key`, so the same event can never notify twice (retries, two servers,
 *      the status watcher and a direct hook can all race safely).
 *   2. `drain()` claims due rows with a short lease, applies the rules
 *      (master switch, admin group switch, customer switch, quiet hours,
 *      expiry, daily caps), and sends to every active device of the customer
 *      in batches of 100. It runs right after the request (`after()`), and the
 *      sweep picks up anything left.
 *   3. Tickets: DeviceNotRegistered turns the device off at once; rate limits
 *      and server errors retry with backoff (max 5 tries).
 *   4. Receipts are checked ~15 min later; a dead device is turned off then too.
 *
 * Quiet hours (IST): chat, "your turn" and low-balance alerts always come
 * through (the customer is in a session). Everything else waits until the end
 * of the quiet window, unless it expires first (then it is dropped).
 *
 * The same rows are the customer's in-app inbox (`inbox: true` rows only:
 * orders, bookings, lives). Rows are deleted after 60 days.
 */

import type { PushGroup } from "@/modules/astro-settings/astro-settings";
export type { PushGroup };

export const PUSH_GROUPS: PushGroup[] = ["live", "reminders", "chat", "wallet", "orders"];

export type PushStatus = "queued" | "sending" | "sent" | "skipped" | "failed" | "expired";

export type SkipReason =
  | "disabled" // master switch off
  | "group_off" // admin turned the group off
  | "pref_off" // the customer turned it off
  | "no_device" // no active device
  | "daily_cap"
  | "stale" // no longer true (the live ended, the turn passed)
  | "expired_in_quiet";

/** Android notification channel (created by the app before it asks for a token). */
export type PushChannel = "default" | "chat" | "live" | "orders";

export interface PushMessageInput {
  customerId: string;
  /** Idempotency key: the same key is queued once, ever (60 days). */
  key: string;
  group: PushGroup;
  /** Finer kind, for analytics and the stale check (e.g. "live_started", "order_shipped"). */
  kind: string;
  title: string;
  body: string;
  /** In-app route opened on tap (must start with "/"). */
  url: string;
  /** Extra data for the app (sessionId, liveId…). Keep it small (4 KB total payload). */
  data?: Record<string, string>;
  /** Bypasses quiet hours (the customer is waiting for it). */
  urgent?: boolean;
  /** Not worth showing after this many seconds (also sent as the push TTL). */
  ttlSec?: number;
  /** Replaces an older notification with the same tag on the phone (chat per session, live per live). */
  tag?: string;
  /** Show in the in-app inbox. */
  inbox?: boolean;
  image?: string;
}

export interface PushDevice {
  id: string;
  token: string;
  customerId: string;
  platform: "android" | "ios";
  app: string;
  appVersion: string;
  deviceName: string;
  active: boolean;
  createdAt: string;
  lastSeenAt: string;
  disabledReason: string | null;
}

export interface PushPrefs {
  groups: Record<PushGroup, boolean>;
  quiet: { enabled: boolean; start: string; end: string };
  updatedAt: string | null;
}

export interface InboxItem {
  id: string;
  group: PushGroup;
  kind: string;
  title: string;
  body: string;
  url: string;
  image: string | null;
  at: string;
  read: boolean;
}

export interface PushRowView {
  id: string;
  key: string;
  customerId: string;
  group: PushGroup;
  kind: string;
  title: string;
  body: string;
  status: PushStatus;
  reason: string | null;
  attempts: number;
  devices: number;
  delivered: number;
  createdAt: string;
  sentAt: string | null;
}
