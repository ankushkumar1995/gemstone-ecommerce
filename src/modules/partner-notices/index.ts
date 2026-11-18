/** Partner notifications + announcements — public API (server). */
export { noticeService, announcementSchema } from "./notice.service";
export type * from "./notice.types";

/**
 * Safe helper for other modules: lazy import (no import cycles) and never
 * throws. Use for "something happened to your account" messages.
 */
export async function notifyPartner(astrologerId: string, n: { kind: import("./notice.types").NoticeKind; title: string; body: string; link?: string }) {
  try {
    const { noticeService } = await import("./notice.service");
    await noticeService.notify(astrologerId, n);
  } catch { /* logged inside */ }
}
