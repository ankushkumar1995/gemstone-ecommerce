import "server-only";

/**
 * Partner notifications + admin announcements.
 *  • notify(): called by other modules (KYC, status, profile review,
 *    agreement). Never throws: a failed notification must not break the action.
 *  • Announcements fan out one notification per partner in the audience, so
 *    each partner has their own read state and the admin sees read counts.
 */

import { z } from "zod";
import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { logger } from "@/core/logger";
import { parse } from "@/core/validation";
import { auditService } from "@/modules/audit";
import { getAstrologerRepository } from "@/modules/astrologers/astrologer.repository";
import { getNoticeRepository } from "./notice.repository";
import type { Announcement, AnnouncementWithStats, NoticeKind, PartnerNotification } from "./notice.types";

export const announcementSchema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(140),
  body: z.string().trim().min(10, "Write at least 10 characters").max(2000),
  audience: z.enum(["all", "approved"]).default("approved"),
  pinned: z.boolean().default(false),
});

const nowIso = () => new Date().toISOString();

export const noticeService = {
  /** Fire-and-forget notification to one partner. */
  async notify(astrologerId: string, n: { kind: NoticeKind; title: string; body: string; link?: string }): Promise<void> {
    try {
      await getNoticeRepository().insertMany([{ astrologerId, ...n, readAt: null, createdAt: nowIso() }]);
    } catch (e) {
      logger.error("partner notify failed", { astrologerId, error: e instanceof Error ? e.message : String(e) });
    }
  },

  /** Same message to many partners (one row each). */
  async notifyMany(astrologerIds: string[], n: { kind: NoticeKind; title: string; body: string; link?: string; announcementId?: string }): Promise<number> {
    try {
      const at = nowIso();
      return await getNoticeRepository().insertMany(astrologerIds.map((astrologerId) => ({ astrologerId, ...n, readAt: null, createdAt: at })));
    } catch (e) {
      logger.error("partner notifyMany failed", { count: astrologerIds.length, error: e instanceof Error ? e.message : String(e) });
      return 0;
    }
  },

  async list(astrologerId: string, before?: string, unreadOnly = false): Promise<{ items: PartnerNotification[]; unread: number; nextBefore: string | null }> {
    const repo = getNoticeRepository();
    const limit = 30;
    const [items, unread] = await Promise.all([repo.list(astrologerId, { limit, before, unreadOnly }), repo.unreadCount(astrologerId)]);
    return { items, unread, nextBefore: items.length === limit ? items[items.length - 1].createdAt : null };
  },

  unreadCount: (astrologerId: string) => getNoticeRepository().unreadCount(astrologerId),

  async markRead(astrologerId: string, ids: string[] | "all"): Promise<{ updated: number; unread: number }> {
    const repo = getNoticeRepository();
    const updated = await repo.markRead(astrologerId, ids, nowIso());
    return { updated, unread: await repo.unreadCount(astrologerId) };
  },

  /** Partner dashboard: latest live announcements for this partner's status. */
  async activeFor(status: string): Promise<Announcement[]> {
    const all = await getNoticeRepository().listAnnouncements();
    return all
      .filter((a) => a.status === "published" && (a.audience === "all" || status === "approved"))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
  },

  /* ---------------- admin ---------------- */

  async listAnnouncements(): Promise<AnnouncementWithStats[]> {
    const repo = getNoticeRepository();
    const list = await repo.listAnnouncements();
    const reads = await repo.readCounts(list.map((a) => a.id));
    return list.map((a) => ({ ...a, readCount: reads[a.id] ?? 0 }));
  },

  async publish(input: unknown, actor: { name: string }): Promise<Result<AnnouncementWithStats>> {
    const p = parse(announcementSchema, input);
    if (!p.ok) return p;
    const repo = getNoticeRepository();
    const a = await repo.createAnnouncement({ ...p.value, status: "published", createdBy: actor.name, createdAt: nowIso(), archivedAt: null, sentTo: 0 });
    // Never send to rejected / suspended / deactivated accounts.
    const statuses = p.value.audience === "approved" ? ["approved"] : ["applied", "under_review", "approved"];
    const targets = (await getAstrologerRepository().findAll()).filter((x) => statuses.includes(x.status)).map((x) => x.id);
    const sent = await this.notifyMany(targets, { kind: "announcement", title: a.title, body: a.body, link: "/astrologer", announcementId: a.id });
    await repo.setSentTo(a.id, sent);
    await auditService.record({ action: "create", entity: "astrologer", entityId: a.id, entityLabel: a.title, summary: `Announcement to ${sent} partners: ${a.title}`, actor: actor.name });
    return ok({ ...a, sentTo: sent, readCount: 0 });
  },

  async archive(id: string, actor: { name: string }): Promise<Result<Announcement>> {
    const a = await getNoticeRepository().archiveAnnouncement(id, nowIso());
    if (!a) return fail(AppErrors.notFound("Announcement not found or already archived"));
    await auditService.record({ action: "status", entity: "astrologer", entityId: a.id, entityLabel: a.title, summary: `Archived announcement: ${a.title}`, actor: actor.name });
    return ok(a);
  },
};
