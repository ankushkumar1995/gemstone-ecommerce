import "server-only";

/**
 * Devotional content service.
 *
 * Public (app + website): published items only, cached 5 minutes and cleared
 * on every admin change. Admin: full create / edit / publish / reorder /
 * delete (soft) / bulk import (upsert by slug). Every admin change is audited.
 * Jaap: signed-in customers send counts; totals, today and streak come back.
 */

import { z } from "zod";
import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { cache } from "@/core/cache";
import { auditService } from "@/modules/audit";
import { DEVOTIONAL_KINDS, PLANETS, type DevotionalCard, type DevotionalItem, type DevotionalKind } from "./devotional.types";

type Doc = Record<string, unknown> & { _id: unknown };

async function M() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return import("./devotional.model");
}

const PREFIX = "devo:";
const TTL = 300;
const nowIso = () => new Date().toISOString();
const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
const isId = (id: string) => /^[a-f0-9]{24}$/i.test(id);

/* ---------------- validation ---------------- */

const text = (max: number) => z.string().trim().max(max);
const list = (maxItems: number, maxLen: number) => z.array(z.string().trim().min(1).max(maxLen)).max(maxItems);
const audioSchema = z.object({
  url: z.string().trim().url().max(600),
  key: z.string().trim().max(400).optional(),
  durationSec: z.number().min(0).max(6 * 3600),
  bytes: z.number().int().min(0).optional(),
  artist: text(120).optional(),
  license: text(300).optional(),
});

export const devotionalInputSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,78}$/, "Slug: lowercase letters, numbers and dashes"),
  kind: z.enum(DEVOTIONAL_KINDS),
  status: z.enum(["draft", "published"]).default("draft"),
  title: text(140).min(2, "Add a title"),
  titleHi: text(200).default(""),
  deity: text(60).default(""),
  devanagari: text(4000).default(""),
  roman: text(4000).default(""),
  meaning: z.object({ en: text(2000).default(""), hi: text(2000).default("") }).default({ en: "", hi: "" }),
  blurb: text(300).default(""),
  verses: list(300, 4000).default([]),
  benefits: list(20, 300).default([]),
  bestTime: text(160).default(""),
  days: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  planets: z.array(z.enum(PLANETS)).max(9).default([]),
  festivals: list(30, 60).default([]),
  tags: list(30, 40).default([]),
  defaultCount: z.number().int().min(1).max(1008).default(11),
  recitationSec: z.number().int().min(3).max(3600).default(30),
  audio: audioSchema.nullable().default(null),
  image: z.string().trim().url().max(600).nullable().default(null),
  featured: z.boolean().default(false),
  order: z.number().int().min(0).max(100_000).default(100),
}).superRefine((v, ctx) => {
  if (v.kind === "mantra" && !v.devanagari) ctx.addIssue({ code: "custom", path: ["devanagari"], message: "A mantra needs its text in Devanagari" });
  if (v.kind !== "mantra" && v.status === "published" && v.verses.length === 0 && !v.devanagari) ctx.addIssue({ code: "custom", path: ["verses"], message: "Add the text (verses) before publishing" });
});
export type DevotionalInput = z.infer<typeof devotionalInputSchema>;

/* ---------------- mapping ---------------- */

function out(d: Doc): DevotionalItem {
  const meaning = (d.meaning as { en?: string; hi?: string }) ?? {};
  return {
    id: String(d._id), slug: d.slug as string, kind: d.kind as DevotionalKind, status: (d.status as DevotionalItem["status"]) ?? "draft",
    title: d.title as string, titleHi: (d.titleHi as string) ?? "", deity: (d.deity as string) ?? "",
    devanagari: (d.devanagari as string) ?? "", roman: (d.roman as string) ?? "", meaning: { en: meaning.en ?? "", hi: meaning.hi ?? "" },
    blurb: (d.blurb as string) ?? "", verses: (d.verses as string[]) ?? [], benefits: (d.benefits as string[]) ?? [], bestTime: (d.bestTime as string) ?? "",
    days: (d.days as number[]) ?? [], planets: (d.planets as string[]) ?? [], festivals: (d.festivals as string[]) ?? [], tags: (d.tags as string[]) ?? [],
    defaultCount: (d.defaultCount as number) ?? 11, recitationSec: (d.recitationSec as number) ?? 30,
    audio: (d.audio as DevotionalItem["audio"]) ?? null, image: (d.image as string) ?? null, featured: d.featured === true, order: (d.order as number) ?? 100,
    plays: (d.plays as number) ?? 0, jaapCount: (d.jaapCount as number) ?? 0,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt ?? ""),
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : String(d.updatedAt ?? ""),
    updatedBy: (d.updatedBy as string) ?? "",
  };
}

const toCard = (i: DevotionalItem): DevotionalCard => ({
  id: i.id, slug: i.slug, kind: i.kind, title: i.title, titleHi: i.titleHi, deity: i.deity, blurb: i.blurb, devanagari: i.devanagari, roman: i.roman,
  bestTime: i.bestTime, days: i.days, planets: i.planets, festivals: i.festivals, defaultCount: i.defaultCount, recitationSec: i.recitationSec,
  image: i.image, featured: i.featured, order: i.order, meaning: i.meaning,
  audio: i.audio ? { url: i.audio.url, durationSec: i.audio.durationSec, ...(i.audio.artist ? { artist: i.audio.artist } : {}) } : null,
});

/** Public copy of an item (no team-only rights notes or counters). */
function publicItem(i: DevotionalItem): Omit<DevotionalItem, "status" | "updatedBy" | "plays" | "jaapCount"> {
  const { status: _s, updatedBy: _u, plays: _p, jaapCount: _j, ...rest } = i;
  void _s; void _u; void _p; void _j;
  return { ...rest, audio: i.audio ? { url: i.audio.url, durationSec: i.audio.durationSec, ...(i.audio.artist ? { artist: i.audio.artist } : {}) } : null };
}

const SORT = { featured: -1, order: 1, title: 1 } as const;

async function published(): Promise<DevotionalItem[]> {
  return cache.wrap(`${PREFIX}published`, TTL, async () => {
    const { DevotionalItemModel } = await M();
    return (await DevotionalItemModel.find({ status: "published", isDeleted: { $ne: true } }).sort(SORT).limit(2000).lean<Doc[]>()).map(out);
  });
}

const invalidate = () => cache.delByPrefix(PREFIX);

/* ---------------- public ---------------- */

export const devotionalService = {
  /** Published items, light rows. Filters: kind (or "library" = everything except mantras), deity, q. */
  async list(f: { kind?: string; deity?: string; q?: string } = {}): Promise<DevotionalCard[]> {
    let rows = await published();
    if (f.kind === "library") rows = rows.filter((r) => r.kind !== "mantra");
    else if (f.kind && (DEVOTIONAL_KINDS as readonly string[]).includes(f.kind)) rows = rows.filter((r) => r.kind === f.kind);
    if (f.deity) rows = rows.filter((r) => r.deity.toLowerCase() === f.deity!.toLowerCase());
    const q = f.q?.trim().toLowerCase();
    if (q) rows = rows.filter((r) => `${r.title} ${r.titleHi} ${r.deity} ${r.roman} ${r.tags.join(" ")} ${r.festivals.join(" ")}`.toLowerCase().includes(q));
    return rows.map(toCard);
  },

  async get(slug: string): Promise<Result<ReturnType<typeof publicItem>>> {
    const i = (await published()).find((r) => r.slug === slug.toLowerCase());
    return i ? ok(publicItem(i)) : fail(AppErrors.notFound("This is not available"));
  },

  /** Today's mantra (IST weekday): a featured mantra for today, else any mantra for today, else the first featured. */
  async today(): Promise<DevotionalCard | null> {
    const weekday = new Date(Date.now() + 5.5 * 3600_000).getUTCDay();
    const ms = (await published()).filter((r) => r.kind === "mantra");
    const pick = ms.find((m) => m.featured && m.days.includes(weekday)) ?? ms.find((m) => m.days.includes(weekday)) ?? ms.find((m) => m.featured) ?? ms[0];
    return pick ? toCard(pick) : null;
  },

  /** Item that belongs to a festival name ("Mokshada Ekadashi" → the ekadashi katha). */
  async forFestival(name: string): Promise<DevotionalCard | null> {
    const n = name.toLowerCase();
    const i = (await published()).find((r) => r.kind !== "mantra" && r.festivals.some((k) => k && n.includes(k.toLowerCase())));
    return i ? toCard(i) : null;
  },

  /** Count a play (rate limited by the route). */
  async played(slug: string): Promise<void> {
    const { DevotionalItemModel } = await M();
    await DevotionalItemModel.updateOne({ slug: slug.toLowerCase(), status: "published" }, { $inc: { plays: 1 } });
  },

  /* ---------- jaap ---------- */

  /** Add recitations (idempotent on clientId). Returns my totals. */
  async addJaap(customerId: string, input: { slug: string; count: number; clientId: string }): Promise<Result<JaapStats>> {
    const count = Math.floor(input.count);
    if (!Number.isFinite(count) || count < 1 || count > 1008) return fail(AppErrors.validation("Count must be between 1 and 1008"));
    const item = (await published()).find((r) => r.slug === input.slug.toLowerCase());
    if (!item) return fail(AppErrors.notFound("This mantra is not available"));
    const { DevotionalJaapModel, DevotionalItemModel } = await M();
    try {
      await DevotionalJaapModel.create({ customerId, clientId: input.clientId, itemSlug: item.slug, count, day: istDay(), at: nowIso() });
      await DevotionalItemModel.updateOne({ _id: item.id }, { $inc: { jaapCount: count } });
    } catch (e) {
      if ((e as { code?: number })?.code !== 11000) throw e; // same send again: already counted
    }
    return ok(await this.myJaap(customerId));
  },

  async myJaap(customerId: string): Promise<JaapStats> {
    const { DevotionalJaapModel } = await M();
    const [byItem, byDay] = await Promise.all([
      DevotionalJaapModel.aggregate<{ _id: string; n: number }>([{ $match: { customerId } }, { $group: { _id: "$itemSlug", n: { $sum: "$count" } } }, { $sort: { n: -1 } }, { $limit: 50 }]),
      DevotionalJaapModel.aggregate<{ _id: string; n: number }>([{ $match: { customerId } }, { $group: { _id: "$day", n: { $sum: "$count" } } }, { $sort: { _id: -1 } }, { $limit: 400 }]),
    ]);
    const today = istDay();
    const days = new Set(byDay.map((d) => d._id));
    // Streak: consecutive days ending today (or yesterday, so it does not break before today's jaap).
    let streak = 0;
    const cursor = new Date(Date.parse(`${today}T00:00:00Z`));
    if (!days.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
    while (days.has(cursor.toISOString().slice(0, 10))) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
    return {
      total: byItem.reduce((a, r) => a + r.n, 0),
      today: byDay.find((d) => d._id === today)?.n ?? 0,
      streak,
      byItem: byItem.map((r) => ({ slug: r._id, count: r.n })),
    };
  },

  /* ---------- admin ---------- */

  async adminList(f: { kind?: string; status?: string; q?: string }): Promise<{ items: DevotionalItem[]; counts: Record<string, number> }> {
    const { DevotionalItemModel } = await M();
    const filter: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (f.kind && (DEVOTIONAL_KINDS as readonly string[]).includes(f.kind)) filter.kind = f.kind;
    if (f.status === "draft" || f.status === "published") filter.status = f.status;
    const q = f.q?.trim();
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 60), "i");
      filter.$or = [{ title: re }, { titleHi: re }, { slug: re }, { deity: re }, { tags: re }];
    }
    const [rows, agg] = await Promise.all([
      DevotionalItemModel.find(filter).sort({ kind: 1, order: 1, title: 1 }).limit(1000).lean<Doc[]>(),
      DevotionalItemModel.aggregate<{ _id: string; n: number }>([{ $match: { isDeleted: { $ne: true } } }, { $group: { _id: "$kind", n: { $sum: 1 } } }]),
    ]);
    const counts: Record<string, number> = { all: 0 };
    for (const a of agg) { counts[a._id] = a.n; counts.all += a.n; }
    return { items: rows.map(out), counts };
  },

  async adminGet(id: string): Promise<Result<DevotionalItem>> {
    if (!isId(id)) return fail(AppErrors.notFound("Not found"));
    const { DevotionalItemModel } = await M();
    const d = await DevotionalItemModel.findOne({ _id: id, isDeleted: { $ne: true } }).lean<Doc>();
    return d ? ok(out(d)) : fail(AppErrors.notFound("Not found"));
  },

  async create(input: unknown, admin: string): Promise<Result<DevotionalItem>> {
    const p = devotionalInputSchema.safeParse(input);
    if (!p.success) return fail(AppErrors.validation(p.error.issues[0]?.message ?? "Check the form", { issues: p.error.issues.slice(0, 20) }));
    const { DevotionalItemModel } = await M();
    if (await DevotionalItemModel.exists({ slug: p.data.slug, isDeleted: { $ne: true } })) return fail(AppErrors.conflict("This slug is already used. Pick another.", { field: "slug" }));
    // A deleted item with the same slug is replaced (soft-deleted rows keep the slug index).
    await DevotionalItemModel.deleteOne({ slug: p.data.slug, isDeleted: true });
    const d = await DevotionalItemModel.create({ ...p.data, updatedBy: admin });
    invalidate();
    await auditService.record({ action: "create", entity: "page", entityId: String(d._id), entityLabel: p.data.title, summary: `Added ${p.data.kind} "${p.data.title}" (${p.data.status})`, actor: admin }).catch(() => undefined);
    return ok(out(d.toObject() as Doc));
  },

  async update(id: string, input: unknown, admin: string): Promise<Result<DevotionalItem>> {
    const cur = await this.adminGet(id);
    if (!cur.ok) return cur;
    const merged = { ...cur.value, ...(input as Record<string, unknown>) };
    const p = devotionalInputSchema.safeParse(merged);
    if (!p.success) return fail(AppErrors.validation(p.error.issues[0]?.message ?? "Check the form", { issues: p.error.issues.slice(0, 20) }));
    const { DevotionalItemModel } = await M();
    if (p.data.slug !== cur.value.slug && (await DevotionalItemModel.exists({ slug: p.data.slug, _id: { $ne: id } }))) return fail(AppErrors.conflict("This slug is already used. Pick another.", { field: "slug" }));
    const d = await DevotionalItemModel.findOneAndUpdate({ _id: id }, { $set: { ...p.data, updatedBy: admin } }, { new: true }).lean<Doc>();
    invalidate();
    const what = cur.value.status !== p.data.status ? (p.data.status === "published" ? "Published" : "Unpublished") : "Updated";
    await auditService.record({ action: "update", entity: "page", entityId: id, entityLabel: p.data.title, summary: `${what} ${p.data.kind} "${p.data.title}"`, actor: admin }).catch(() => undefined);
    return ok(out(d!));
  },

  async remove(id: string, admin: string): Promise<Result<{ ok: true }>> {
    const cur = await this.adminGet(id);
    if (!cur.ok) return cur;
    const { DevotionalItemModel } = await M();
    await DevotionalItemModel.updateOne({ _id: id }, { $set: { isDeleted: true, status: "draft", updatedBy: admin } });
    invalidate();
    await auditService.record({ action: "delete", entity: "page", entityId: id, entityLabel: cur.value.title, summary: `Deleted ${cur.value.kind} "${cur.value.title}"`, actor: admin }).catch(() => undefined);
    return ok({ ok: true });
  },

  /** Save a new order for a list of ids (drag to reorder). */
  async reorder(ids: string[], admin: string): Promise<Result<{ ok: true }>> {
    const { DevotionalItemModel } = await M();
    const good = ids.filter(isId).slice(0, 1000);
    await DevotionalItemModel.bulkWrite(good.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: (i + 1) * 10, updatedBy: admin } } } })));
    invalidate();
    return ok({ ok: true });
  },

  /**
   * Bulk import: an array of items, upserted by slug. Each row is checked on
   * its own; bad rows are reported and skipped. `dryRun` only reports.
   */
  async importMany(rows: unknown, admin: string, dryRun = false): Promise<Result<{ created: number; updated: number; failed: { row: number; slug: string; error: string }[] }>> {
    if (!Array.isArray(rows)) return fail(AppErrors.validation("Paste a JSON array of items"));
    if (rows.length > 1000) return fail(AppErrors.validation("Up to 1000 items at a time"));
    const { DevotionalItemModel } = await M();
    let created = 0, updated = 0;
    const failed: { row: number; slug: string; error: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const p = devotionalInputSchema.safeParse(rows[i]);
      const slug = String((rows[i] as { slug?: unknown })?.slug ?? "");
      if (!p.success) { failed.push({ row: i + 1, slug, error: `${p.error.issues[0]?.path.join(".") || "row"}: ${p.error.issues[0]?.message}` }); continue; }
      const exists = await DevotionalItemModel.exists({ slug: p.data.slug });
      if (!dryRun) await DevotionalItemModel.updateOne({ slug: p.data.slug }, { $set: { ...p.data, isDeleted: false, updatedBy: admin } }, { upsert: true });
      if (exists) updated++; else created++;
    }
    if (!dryRun) {
      invalidate();
      await auditService.record({ action: "update", entity: "page", entityLabel: "Mantras & Aarti import", summary: `Imported devotional items: ${created} new, ${updated} updated, ${failed.length} skipped`, actor: admin }).catch(() => undefined);
    }
    return ok({ created, updated, failed });
  },
};

export interface JaapStats { total: number; today: number; streak: number; byItem: { slug: string; count: number }[] }
