/**
 * Sales channels: where a catalog item (service, pooja, later products /
 * banners) is shown: the website, the mobile app, or both.
 *
 *   channels: { web: boolean; app: boolean }      ("app" = Android + iOS)
 *
 * Rules (enforced on the SERVER, never only in a client):
 *  • An item is visible on a channel when it is published (its own status)
 *    AND that channel's flag is on.
 *  • A missing field means "both on", so records created before this existed
 *    keep showing everywhere without a migration.
 *  • The caller's channel comes from the X-Client header the app sends
 *    (android | ios → "app"); everything else is "web".
 *  • Existing bookings / orders are never affected: the flag only controls
 *    discovery and NEW bookings.
 *
 * Safe for both server and client code (no server-only imports).
 */

import { z } from "zod";

export type Channel = "web" | "app";
export interface Channels { web: boolean; app: boolean }

export const ALL_CHANNELS: Readonly<Channels> = Object.freeze({ web: true, app: true });

export const channelsSchema = z.object({ web: z.boolean(), app: z.boolean() });

/** Fill in missing / malformed values: anything not explicitly `false` is on. */
export function normalizeChannels(c: unknown): Channels {
  const v = (c && typeof c === "object" ? c : {}) as Partial<Record<keyof Channels, unknown>>;
  return { web: v.web !== false, app: v.app !== false };
}

export function isVisibleOn(c: unknown, channel: Channel): boolean {
  return normalizeChannels(c)[channel];
}

/** Channel of the current request. The app sends `X-Client: android|ios`. */
export function channelOf(headers: Headers): Channel {
  const raw = (headers.get("x-client") ?? "").toLowerCase();
  return raw === "android" || raw === "ios" ? "app" : "web";
}

/** Short label for admin lists. */
export function channelsLabel(c: unknown): "Web + App" | "Web only" | "App only" | "Not shown" {
  const n = normalizeChannels(c);
  if (n.web && n.app) return "Web + App";
  if (n.web) return "Web only";
  if (n.app) return "App only";
  return "Not shown";
}

/** For audit summaries: "website on → off" etc. Empty string when unchanged. */
export function channelsDiff(before: unknown, after: unknown): string {
  const a = normalizeChannels(before);
  const b = normalizeChannels(after);
  const parts: string[] = [];
  if (a.web !== b.web) parts.push(`website ${a.web ? "on" : "off"} → ${b.web ? "on" : "off"}`);
  if (a.app !== b.app) parts.push(`app ${a.app ? "on" : "off"} → ${b.app ? "on" : "off"}`);
  return parts.join(", ");
}
