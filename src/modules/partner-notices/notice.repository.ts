import "server-only";

/** Partner notifications + announcements — repository (mock or Mongo via dataSourceFor). */

import { dataSourceFor } from "@/core/config/env";
import { newId } from "@/core/id";
import type { Announcement, PartnerNotification } from "./notice.types";

const KEEP_DAYS = 180;
const expiry = (from: string) => new Date(Date.parse(from) + KEEP_DAYS * 86400_000);

export interface NoticeRepository {
  insertMany(rows: Omit<PartnerNotification, "id">[]): Promise<number>;
  list(astrologerId: string, opts: { limit: number; before?: string; unreadOnly?: boolean }): Promise<PartnerNotification[]>;
  unreadCount(astrologerId: string): Promise<number>;
  markRead(astrologerId: string, ids: string[] | "all", at: string): Promise<number>;

  createAnnouncement(a: Omit<Announcement, "id">): Promise<Announcement>;
  setSentTo(id: string, n: number): Promise<void>;
  listAnnouncements(): Promise<Announcement[]>;
  getAnnouncement(id: string): Promise<Announcement | null>;
  archiveAnnouncement(id: string, at: string): Promise<Announcement | null>;
  readCounts(ids: string[]): Promise<Record<string, number>>;
}

/* ---------------- mock ---------------- */
declare global { var __noticeMem: { n: PartnerNotification[]; a: Announcement[] } | undefined }
const mem = global.__noticeMem ?? { n: [], a: [] };
global.__noticeMem = mem;

const mockRepo: NoticeRepository = {
  async insertMany(rows) { for (const r of rows) mem.n.push({ ...r, id: newId("ntf") }); return rows.length; },
  async list(id, o) {
    return mem.n.filter((x) => x.astrologerId === id && (!o.before || x.createdAt < o.before) && (!o.unreadOnly || !x.readAt))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, o.limit).map((x) => ({ ...x }));
  },
  async unreadCount(id) { return mem.n.filter((x) => x.astrologerId === id && !x.readAt).length; },
  async markRead(id, ids, at) {
    let k = 0;
    for (const x of mem.n) if (x.astrologerId === id && !x.readAt && (ids === "all" || ids.includes(x.id))) { x.readAt = at; k++; }
    return k;
  },
  async createAnnouncement(a) { const row = { ...a, id: newId("ann") }; mem.a.push(row); return { ...row }; },
  async setSentTo(id, n) { const a = mem.a.find((x) => x.id === id); if (a) a.sentTo = n; },
  async listAnnouncements() { return [...mem.a].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((x) => ({ ...x })); },
  async getAnnouncement(id) { const a = mem.a.find((x) => x.id === id); return a ? { ...a } : null; },
  async archiveAnnouncement(id, at) { const a = mem.a.find((x) => x.id === id && x.status === "published"); if (!a) return null; a.status = "archived"; a.archivedAt = at; return { ...a }; },
  async readCounts(ids) {
    const out: Record<string, number> = {};
    for (const x of mem.n) if (x.announcementId && ids.includes(x.announcementId) && x.readAt) out[x.announcementId] = (out[x.announcementId] ?? 0) + 1;
    return out;
  },
};

/* ---------------- mongo ---------------- */
type Row = Record<string, unknown> & { _id: unknown };
const isOid = (id: string) => /^[a-f0-9]{24}$/i.test(id);
const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : typeof d === "string" ? d : null);
async function M() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return import("./notice.model");
}
const toN = (d: Row): PartnerNotification => ({
  id: String(d._id), astrologerId: String(d.astrologerId), kind: d.kind as PartnerNotification["kind"], title: String(d.title), body: String(d.body),
  ...(d.link ? { link: String(d.link) } : {}), ...(d.announcementId ? { announcementId: String(d.announcementId) } : {}),
  readAt: iso(d.readAt), createdAt: iso(d.createdAt) ?? new Date().toISOString(),
});
const toA = (d: Row): Announcement => ({
  id: String(d._id), title: String(d.title), body: String(d.body), audience: d.audience as Announcement["audience"], pinned: Boolean(d.pinned),
  status: d.status as Announcement["status"], createdBy: String(d.createdBy), createdAt: iso(d.createdAt) ?? "", archivedAt: iso(d.archivedAt), sentTo: Number(d.sentTo ?? 0),
});

const mongoRepo: NoticeRepository = {
  async insertMany(rows) {
    if (!rows.length) return 0;
    const { NotificationModel } = await M();
    const r = await NotificationModel.insertMany(rows.map((x) => ({ ...x, createdAt: new Date(x.createdAt), readAt: null, expireAt: expiry(x.createdAt) })), { ordered: false });
    return r.length;
  },
  async list(id, o) {
    const { NotificationModel } = await M();
    const q: Record<string, unknown> = { astrologerId: id };
    if (o.before) q.createdAt = { $lt: new Date(o.before) };
    if (o.unreadOnly) q.readAt = null;
    return (await NotificationModel.find(q).sort({ createdAt: -1 }).limit(o.limit).lean<Row[]>()).map(toN);
  },
  async unreadCount(id) { const { NotificationModel } = await M(); return NotificationModel.countDocuments({ astrologerId: id, readAt: null }); },
  async markRead(id, ids, at) {
    const { NotificationModel } = await M();
    const q: Record<string, unknown> = { astrologerId: id, readAt: null };
    if (ids !== "all") q._id = { $in: ids.filter(isOid) };
    return (await NotificationModel.updateMany(q, { $set: { readAt: new Date(at) } })).modifiedCount;
  },
  async createAnnouncement(a) {
    const { AnnouncementModel } = await M();
    const d = await AnnouncementModel.create({ ...a, createdAt: new Date(a.createdAt), archivedAt: null });
    return toA(d.toObject() as Row);
  },
  async setSentTo(id, n) { const { AnnouncementModel } = await M(); await AnnouncementModel.updateOne({ _id: id }, { $set: { sentTo: n } }); },
  async listAnnouncements() { const { AnnouncementModel } = await M(); return (await AnnouncementModel.find().sort({ createdAt: -1 }).limit(200).lean<Row[]>()).map(toA); },
  async getAnnouncement(id) { if (!isOid(id)) return null; const { AnnouncementModel } = await M(); const d = await AnnouncementModel.findById(id).lean<Row>(); return d ? toA(d) : null; },
  async archiveAnnouncement(id, at) {
    if (!isOid(id)) return null;
    const { AnnouncementModel } = await M();
    const d = await AnnouncementModel.findOneAndUpdate({ _id: id, status: "published" }, { $set: { status: "archived", archivedAt: new Date(at) } }, { returnDocument: "after" }).lean<Row>();
    return d ? toA(d) : null;
  },
  async readCounts(ids) {
    if (!ids.length) return {};
    const { NotificationModel } = await M();
    const rows = await NotificationModel.aggregate<{ _id: string; n: number }>([{ $match: { announcementId: { $in: ids }, readAt: { $ne: null } } }, { $group: { _id: "$announcementId", n: { $sum: 1 } } }]);
    return Object.fromEntries(rows.map((r) => [r._id, r.n]));
  },
};

export function getNoticeRepository(): NoticeRepository {
  return dataSourceFor("partner_notices") === "mongo" ? mongoRepo : mockRepo;
}
