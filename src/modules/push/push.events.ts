import "server-only";

/**
 * What sends a push, and the words. Every function is best effort and safe to
 * call twice: keys make each notification unique.
 *
 *   live started        followers with alerts on      group live       key live:<liveId>:<customer>
 *   "remind me" live    customers who asked           group reminders  (same key: one per live per customer)
 *   chat accepted       the customer                  group chat       urgent
 *   new chat message    the customer, only when away  group chat       urgent, one per cooldown, replaces the last
 *   your turn           the customer in line          group chat       urgent, expires with the offer
 *   low balance         the customer in a chat        group wallet     urgent
 *   order / booking     the customer                  group orders     status watcher (any screen that changes it)
 */

import mongoose from "mongoose";
import { astroSettingsService } from "@/modules/astro-settings";
import { pushService } from "./push.service";
import type { PushMessageInput } from "./push.types";

type Doc = Record<string, unknown> & { _id: unknown };
const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const https = (u: unknown) => (typeof u === "string" && /^https:\/\//.test(u) ? u : undefined);
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

async function db() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return mongoose.connection;
}

/* ============================================================ *
 * Live
 * ============================================================ */

export async function liveStarted(s: { id: string; title: string; astrologerId: string; astrologer: { name: string; photo: string | null } }): Promise<number> {
  const st = await astroSettingsService.get();
  const { AstroFollowModel, LiveReminderModel } = await import("@/modules/live/live.model");
  const { ConsultBlockModel } = await import("@/modules/consultations/consult.model");
  const [followers, reminders, blocked] = await Promise.all([
    AstroFollowModel.find({ astrologerId: s.astrologerId, alerts: { $ne: false } }).select("customerId").limit(st.push.liveFanoutMax).lean<Doc[]>(),
    LiveReminderModel.find({ liveId: s.id }).select("customerId").limit(st.push.liveFanoutMax).lean<Doc[]>(),
    ConsultBlockModel.find({ astrologerId: s.astrologerId }).select("customerId").lean<Doc[]>(),
  ]);
  const no = new Set(blocked.map((b) => b.customerId as string));
  const reminded = new Set(reminders.map((r) => r.customerId as string));
  const name = s.astrologer.name;
  const base = { url: `/livestream/${s.id}`, data: { liveId: s.id }, ttlSec: 2 * 3600, tag: `live-${s.id}`, inbox: true, image: https(s.astrologer.photo) };
  const msgs: PushMessageInput[] = [];
  for (const cid of reminded) {
    if (no.has(cid)) continue;
    msgs.push({ ...base, customerId: cid, key: `live:${s.id}:${cid}`, group: "reminders", kind: "live_reminder", title: `${name} is live now`, body: short(`The live you asked to be reminded about has started: ${s.title}`, 180) });
  }
  for (const f of followers) {
    const cid = f.customerId as string;
    if (no.has(cid) || reminded.has(cid)) continue;
    msgs.push({ ...base, customerId: cid, key: `live:${s.id}:${cid}`, group: "live", kind: "live_started", title: `${name} is live`, body: short(`${s.title}. Join now and ask your question.`, 180) });
  }
  let n = 0;
  for (let i = 0; i < msgs.length; i += 500) n += await pushService.queue(msgs.slice(i, i + 500));
  return n;
}

/* ============================================================ *
 * Chat
 * ============================================================ */

type ChatLike = { id: string; customerId: string; astrologer: { name: string; slug?: string } };

export async function chatAccepted(s: ChatLike): Promise<void> {
  await pushService.queue({
    customerId: s.customerId, key: `chatacc:${s.id}`, group: "chat", kind: "chat_accepted", urgent: true, ttlSec: 300, tag: `chat-${s.id}`,
    title: `${s.astrologer.name} joined your chat`, body: "Open the chat to start. Billing starts with their first reply.",
    url: `/chat/${s.id}`, data: { sessionId: s.id },
  });
}

/** A new message from the astrologer while the customer is away from the chat. */
export async function chatMessage(s: ChatLike, text: string): Promise<void> {
  const st = await astroSettingsService.get();
  const bucket = Math.floor(Date.now() / (st.push.chatCooldownSec * 1000));
  await pushService.queue({
    customerId: s.customerId, key: `chatmsg:${s.id}:${bucket}`, group: "chat", kind: "chat_message", urgent: true, ttlSec: 600, tag: `chat-${s.id}`,
    title: s.astrologer.name, body: short(text.replace(/\s+/g, " ").trim(), 140) || "Sent you a message",
    url: `/chat/${s.id}`, data: { sessionId: s.id },
  });
}

export async function lowBalance(s: ChatLike): Promise<void> {
  await pushService.queue({
    customerId: s.customerId, key: `lowbal:${s.id}`, group: "wallet", kind: "low_balance", urgent: true, ttlSec: 300, tag: `chat-${s.id}`,
    title: "Balance is low", body: `About 2 minutes left in your chat with ${s.astrologer.name}. Recharge to keep chatting.`,
    url: `/chat/${s.id}`, data: { sessionId: s.id },
  });
}

export async function waitlistTurn(e: { id: string; customerId: string; astrologer: { name: string; slug: string }; offerSec: number }): Promise<void> {
  await pushService.queue({
    customerId: e.customerId, key: `wl:${e.id}`, group: "chat", kind: "waitlist_turn", urgent: true, ttlSec: Math.max(20, e.offerSec), tag: `wl-${e.id}`,
    title: `Your turn with ${e.astrologer.name}`, body: `Start your chat now. Your turn is held for ${Math.round(e.offerSec)} seconds.`,
    url: `/session/${e.astrologer.slug}`, data: { entryId: e.id },
  });
}

/* ============================================================ *
 * Orders and bookings: status watcher
 * ============================================================ */

type Line = { title: string; body: string };

function orderLine(o: Doc): Line | null {
  const n = o.orderNumber as string;
  const f = (o.fulfillment as { courier?: string; trackingNumber?: string }) ?? {};
  const refund = o.refund as { amount?: number; to?: string } | null;
  switch (o.status) {
    case "confirmed": return { title: `Order ${n} confirmed`, body: "Thank you. We are getting it ready." };
    case "shipped": return { title: `Order ${n} is on the way`, body: f.courier ? `Shipped with ${f.courier}${f.trackingNumber ? `, tracking ${f.trackingNumber}` : ""}.` : "Your order has been shipped." };
    case "delivered": return { title: `Order ${n} delivered`, body: "We hope you love it. Tap if you need any help." };
    case "cancelled": return { title: `Order ${n} cancelled`, body: refund?.amount ? `${inr(refund.amount)} is being refunded${refund.to === "wallet" ? " to your wallet" : ""}.` : "Your order was cancelled." };
    case "refunded": return { title: `Refund for order ${n}`, body: refund?.amount ? `${inr(refund.amount)} was refunded${refund.to === "wallet" ? " to your wallet" : " to your payment method"}.` : "Your refund has been processed." };
    default: return null;
  }
}

function poojaLines(b: Doc): { suffix: string; line: Line }[] {
  const title = ((b.pooja as { title?: string }) ?? {}).title ?? "Your pooja";
  const n = b.bookingNumber as string;
  const slot = ((b.slot as { label?: string }) ?? {}).label ?? "";
  const out: { suffix: string; line: Line }[] = [];
  const s = b.status as string;
  const map: Record<string, Line> = {
    confirmed: { title: `${title} booked`, body: slot ? `Booking ${n} for ${slot}.` : `Booking ${n} is confirmed.` },
    assigned: { title: "Pandit assigned", body: `${(b.panditName as string) || "Our pandit"} will perform your ${title}.` },
    in_progress: { title: `${title} has started`, body: "Tap to follow along." },
    performed: { title: `${title} is done`, body: "The video and photos will be ready soon." },
    completed: { title: `${title} completed`, body: "Watch the video and see the photos." },
    cancelled: { title: `Booking ${n} cancelled`, body: (b.cancelReason as string) ? short(b.cancelReason as string, 120) : "Your booking was cancelled." },
  };
  if (map[s]) out.push({ suffix: s, line: map[s] });
  const prasad = ((b.prasad as { status?: string; courier?: string }) ?? {});
  if (prasad.status === "shipped") out.push({ suffix: "prasad_shipped", line: { title: "Prasad is on the way", body: prasad.courier ? `Shipped with ${prasad.courier}.` : "Your prasad has been shipped." } });
  const refunded = ((b.payment as { refunded?: number }) ?? {}).refunded ?? 0;
  if (refunded > 0) out.push({ suffix: `refund_${refunded}`, line: { title: `Refund for ${n}`, body: `${inr(refunded)} refund started.` } });
  return out;
}

function serviceLine(b: Doc): Line | null {
  const t = (b.serviceTitle as string) || "Your booking";
  const n = b.bookingNumber as string;
  switch (b.status) {
    case "confirmed": return { title: `${t} confirmed`, body: `Booking ${n}. We will be in touch soon.` };
    case "in_progress": return { title: `${t} in progress`, body: "Our astrologer has started on it." };
    case "completed": return { title: `${t} is ready`, body: "Tap to see the details." };
    case "cancelled": return { title: `Booking ${n} cancelled`, body: "Your booking was cancelled." };
    case "refunded": return { title: `Refund for ${n}`, body: "Your refund has been processed." };
    default: return null;
  }
}

/**
 * Reads orders / bookings changed since the last run and queues one push per
 * new status. First run only sets the watermark (no backfill of old orders).
 */
export async function watchStatuses(): Promise<{ queued: number }> {
  const conn = await db();
  const { PushJobModel } = await import("./push.model");
  let queued = 0;
  const jobs: { key: string; coll: string; build: (d: Doc) => PushMessageInput[] }[] = [
    {
      key: "watch:orders", coll: "orders",
      build: (o) => {
        const l = orderLine(o);
        return l && o.customerId ? [{ customerId: o.customerId as string, key: `order:${String(o._id)}:${o.status}`, group: "orders", kind: `order_${o.status}`, ...l, url: `/track/${o.orderNumber}`, inbox: true, tag: `order-${String(o._id)}` }] : [];
      },
    },
    {
      key: "watch:pooja_bookings", coll: "pooja_bookings",
      build: (b) => {
        const cid = ((b.customer as { customerId?: string | null }) ?? {}).customerId;
        if (!cid || b.status === "pending_payment") return [];
        return poojaLines(b).map(({ suffix, line }) => ({ customerId: cid, key: `pooja:${String(b._id)}:${suffix}`, group: "orders" as const, kind: `pooja_${suffix.split("_")[0]}`, ...line, url: `/my-booking/${b.bookingNumber}`, inbox: true, tag: `booking-${String(b._id)}` }));
      },
    },
    {
      key: "watch:bookings", coll: "bookings",
      build: (b) => {
        const l = serviceLine(b);
        return l && b.customerId ? [{ customerId: b.customerId as string, key: `booking:${String(b._id)}:${b.status}`, group: "orders", kind: `booking_${b.status}`, ...l, url: `/my-booking/${b.bookingNumber}`, inbox: true, tag: `booking-${String(b._id)}` }] : [];
      },
    },
  ];
  for (const j of jobs) {
    const job = await PushJobModel.findOne({ key: j.key }).lean<Doc>();
    const now = new Date();
    if (!job) { await PushJobModel.updateOne({ key: j.key }, { $setOnInsert: { since: now.toISOString(), at: now.toISOString() } }, { upsert: true }); continue; }
    // A small overlap so a write that landed during the last run is not missed (keys dedupe it).
    const since = new Date(Date.parse(job.since as string) - 60_000);
    const rows = (await conn.collection(j.coll).find({ updatedAt: { $gt: since }, isDeleted: { $ne: true } }).sort({ updatedAt: 1 }).limit(500).toArray()) as unknown as Doc[];
    if (!rows.length) continue;
    const msgs = rows.flatMap((r) => { try { return j.build(r); } catch { return []; } });
    if (msgs.length) queued += await pushService.queue(msgs);
    const last = rows[rows.length - 1].updatedAt as Date;
    await PushJobModel.updateOne({ key: j.key }, { $set: { since: (last instanceof Date ? last : now).toISOString(), at: now.toISOString() } });
  }
  return { queued };
}

export const pushEvents = { liveStarted, chatAccepted, chatMessage, lowBalance, waitlistTurn, watchStatuses };
