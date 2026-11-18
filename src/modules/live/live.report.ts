import "server-only";

/**
 * After-live report for the astrologer (partner panel).
 *
 *   viewers    unique, peak, average watching and a graph (a point about every
 *              minute, recorded while live; older lives have no graph)
 *   followers  people who followed during the live (and up to 30 min after),
 *              and how many of them tapped Follow on the live screen
 *   gifts      count, value, by gift, top gifters (first names only)
 *   questions  asked / answered / skipped, Super Chats kept and refunded
 *   chats      viewers who joined the 1-to-1 line from this live, and the paid
 *              chats this live brought: chats with someone who watched it or
 *              lined up from it, started from the live until 2 hours after
 *   earnings   live (gifts + Super Chats, after commission) + those chats
 *
 * Works for a live that is still on (numbers so far).
 */

import mongoose from "mongoose";
import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";

type Doc = Record<string, unknown> & { _id: unknown };

async function M() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return import("./live.model");
}

export interface LiveReport {
  id: string; liveNumber: string; title: string; tags: string[]; status: string;
  startedAt: string | null; endedAt: string | null; durationSec: number; endReason: string | null; endText: string | null;
  viewers: { unique: number; peak: number; avg: number | null; samples: { at: string; n: number }[] };
  engagement: { likes: number; comments: number; questionsAsked: number; questionsAnswered: number; questionsSkipped: number; superChats: number; superChatsKeptPaise: number; superChatsRefunded: number; reminders: number };
  followers: { gained: number; fromLive: number; total: number };
  gifts: { count: number; paise: number; byGift: { id: string; name: string; emoji: string; count: number; paise: number }[]; topGifters: { name: string; count: number; paise: number }[] };
  chats: { joinedLine: number; tookTurn: number; started: number; minutes: number; earningPaise: number };
  earnings: { livePaise: number; chatPaise: number; totalPaise: number };
  commissionPct: number;
  serverNow: string;
}

const END_TEXT: Record<string, string> = {
  astrologer: "You ended the live.",
  time_limit: "The live reached its time limit.",
  astrologer_left: "The panel was closed for too long, so the live ended.",
  admin: "Ended by AstroUnkle support.",
};

const firstName = (n: unknown) => (String(n || "Guest").trim().split(/\s+/)[0] || "Guest").slice(0, 24);

export async function liveReport(astrologerId: string, id: string): Promise<Result<LiveReport>> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return fail(AppErrors.notFound("Live not found"));
  const { LiveSessionModel, LiveEventModel, LiveQueueModel, LiveViewerModel, AstroFollowModel } = await M();
  const s = await LiveSessionModel.findById(id).lean<Doc>();
  if (!s || s.astrologerId !== astrologerId) return fail(AppErrors.notFound("Live not found"));
  if (!s.startedAt) return fail(AppErrors.validation("This live has not started, so there is no report yet.", { reason: "NOT_STARTED" }));

  const startedAt = s.startedAt as string;
  const endedAt = (s.endedAt as string) ?? null;
  const endMs = endedAt ? Date.parse(endedAt) : Date.now();
  const startMs = Date.parse(startedAt);
  const durationSec = Math.max(0, Math.round((endMs - startMs) / 1000));
  const samples = ((s.viewerSamples as { at: string; n: number }[]) ?? []).filter((p) => p && typeof p.n === "number");
  const avg = samples.length ? Math.round((samples.reduce((a, p) => a + p.n, 0) / samples.length) * 10) / 10 : null;

  // Followers gained while live (and a short tail after, people follow from the end card).
  const followTo = new Date(endMs + 30 * 60_000).toISOString();
  const [gained, fromLive, total] = await Promise.all([
    AstroFollowModel.countDocuments({ astrologerId, at: { $gte: startedAt, $lte: followTo } }),
    AstroFollowModel.countDocuments({ astrologerId, via: "live", at: { $gte: startedAt, $lte: followTo } }),
    AstroFollowModel.countDocuments({ astrologerId }),
  ]);

  // Gifts.
  const giftRows = await LiveEventModel.find({ liveId: id, kind: "gift" }).select("customerId name gift").limit(5000).lean<Doc[]>();
  const byGift = new Map<string, { id: string; name: string; emoji: string; count: number; paise: number }>();
  const byWho = new Map<string, { name: string; count: number; paise: number }>();
  let giftCount = 0, giftPaise = 0;
  for (const r of giftRows) {
    const g = r.gift as { id: string; name: string; emoji: string; price: number; count?: number } | null;
    if (!g) continue;
    const n = g.count ?? 1;
    const p = Math.round(g.price * n * 100);
    giftCount += n; giftPaise += p;
    const x = byGift.get(g.id) ?? { id: g.id, name: g.name, emoji: g.emoji, count: 0, paise: 0 };
    x.count += n; x.paise += p; byGift.set(g.id, x);
    const k = String(r.customerId ?? r.name);
    const w = byWho.get(k) ?? { name: firstName(r.name), count: 0, paise: 0 };
    w.count += n; w.paise += p; byWho.set(k, w);
  }

  // Questions.
  const qRows = await LiveQueueModel.find({ liveId: id }).select("status paidPaise paidState").limit(5000).lean<Doc[]>();
  const answered = qRows.filter((q) => q.status === "answered").length;
  const skipped = qRows.filter((q) => q.status === "skipped").length;
  const scRefunded = qRows.filter((q) => q.paidState === "refunded").length;

  // Chats this live brought.
  const line = await mongooseCol("consult_waitlist").find({ fromLiveId: id }).project({ customerId: 1, status: 1, sessionId: 1 }).limit(2000).toArray();
  const viewers = (await LiveViewerModel.find({ liveId: id }).select("customerId").limit(20_000).lean<Doc[]>()).map((v) => v.customerId as string);
  const people = [...new Set([...viewers, ...line.map((l) => String(l.customerId))])];
  const { ConsultSessionModel } = await import("@/modules/consultations/consult.model");
  const chatTo = new Date(endMs + 2 * 3600_000).toISOString();
  const sessions = people.length
    ? await ConsultSessionModel.find({ astrologerId, customerId: { $in: people }, requestedAt: { $gte: startedAt, $lte: chatTo }, acceptedAt: { $ne: null } })
      .select("earningPaise minutesCharged tipPaise").limit(2000).lean<Doc[]>()
    : [];
  const chatEarning = sessions.reduce((a, x) => a + ((x.earningPaise as number) ?? 0) + ((x.tipPaise as number) ?? 0), 0);
  const livePaise = (s.earningPaise as number) ?? 0;

  return ok({
    id, liveNumber: s.liveNumber as string, title: s.title as string, tags: (s.tags as string[]) ?? [], status: s.status as string,
    startedAt, endedAt, durationSec, endReason: (s.endReason as string) ?? null, endText: s.endReason ? END_TEXT[s.endReason as string] ?? null : null,
    viewers: { unique: (s.uniqueViewers as number) ?? 0, peak: (s.peakViewers as number) ?? 0, avg, samples },
    engagement: {
      likes: (s.likes as number) ?? 0, comments: (s.commentCount as number) ?? 0,
      questionsAsked: qRows.length, questionsAnswered: answered, questionsSkipped: skipped,
      superChats: (s.superChatCount as number) ?? 0, superChatsKeptPaise: (s.superChatPaise as number) ?? 0, superChatsRefunded: scRefunded,
      reminders: (s.reminderCount as number) ?? 0,
    },
    followers: { gained, fromLive, total },
    gifts: {
      count: giftCount, paise: giftPaise,
      byGift: [...byGift.values()].sort((a, b) => b.paise - a.paise),
      topGifters: [...byWho.values()].sort((a, b) => b.paise - a.paise).slice(0, 5),
    },
    chats: {
      joinedLine: line.length,
      tookTurn: line.filter((l) => l.status === "accepted").length,
      started: sessions.length,
      minutes: sessions.reduce((a, x) => a + ((x.minutesCharged as number) ?? 0), 0),
      earningPaise: chatEarning,
    },
    earnings: { livePaise, chatPaise: chatEarning, totalPaise: livePaise + chatEarning },
    commissionPct: (s.commissionPct as number) ?? 0,
    serverNow: new Date().toISOString(),
  });
}

/** The waitlist model lives in the consultations module; read its collection directly (connected in M). */
const mongooseCol = (name: string) => mongoose.connection.collection(name);
