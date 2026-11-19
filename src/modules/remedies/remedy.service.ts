import "server-only";

/**
 * Remedy suggestions in chat + commission on what the customer buys.
 * Rules and lifecycle: see remedy.types.ts. Business numbers come from
 * program settings → Remedy suggestions (admin).
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { isVisibleOn } from "@/core/channels";
import { auditService } from "@/modules/audit";
import { astroSettingsService } from "@/modules/astro-settings";
import type { ConsultCard, ConsultMessage } from "@/modules/consultations/consult.types";
import type { RemedyCatalogItem, RemedyKind, RemedyRules, RemedySale, RemedySaleStatus, RemedyStats, RemedySuggestion } from "./remedy.types";

type Doc = Record<string, unknown> & { _id: unknown };

const DAY = 86_400_000;
const nowIso = () => new Date().toISOString();
const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const isOid = (id: string) => /^[a-f0-9]{24}$/i.test(id);
/** Orders that count as bought (paid online, or COD confirmed). */
const ORDER_BOUGHT: ("confirmed" | "packed" | "shipped" | "delivered")[] = ["confirmed", "packed", "shipped", "delivered"];
const BOOKING_DONE = ["performed", "completed"];
/** Grace after a suggestion expires, for a purchase made in time but paid / seen a little later. */
const LATE_GRACE_MS = 3 * DAY;
/** How long after confirming we still watch for a late refund. */
const WATCH_CONFIRMED_MS = 90 * DAY;

async function M() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return import("./remedy.model");
}

function isDup(e: unknown, field: string) {
  const err = e as { code?: number; keyPattern?: Record<string, unknown>; message?: string };
  return err?.code === 11000 && (Boolean(err.keyPattern?.[field]) || String(err.message ?? "").includes(field));
}

const sugOut = (d: Doc): RemedySuggestion => {
  const { _id, ...rest } = d;
  return { ...(rest as unknown as Omit<RemedySuggestion, "id">), id: String(_id), mrp: (d.mrp as number | null) ?? null, msgSeq: (d.msgSeq as number | null) ?? null, sales: (d.sales as number) ?? 0 };
};

function saleOut(d: Doc): RemedySale {
  const { _id, ledgerAt: _l, ...rest } = d;
  void _l;
  const s = rest as unknown as Omit<RemedySale, "id" | "stage">;
  const stage = s.status === "pending" ? (s.confirmAt ? "in_window" : "waiting") : s.status;
  return { ...s, id: String(_id), stage, history: (d.history as RemedySale["history"]) ?? [] };
}

export function commissionFor(basePaise: number, pct: number, capPaise: number): number {
  const c = Math.floor((Math.max(0, basePaise) * pct) / 100);
  return capPaise > 0 ? Math.min(c, capPaise) : c;
}

async function rules(): Promise<RemedyRules> {
  const st = await astroSettingsService.get();
  const r = st.remedy;
  return { enabled: r.enabled, commissionPct: r.commissionPct, attributionDays: r.attributionDays, confirmAfterDays: r.confirmAfterDays, allowProducts: r.allowProducts, allowPoojas: r.allowPoojas, maxPerChat: r.maxPerChat, maxCommissionPaise: r.maxCommission * 100 };
}

async function notify(astrologerId: string, title: string, body: string) {
  try {
    const { notifyPartner } = await import("@/modules/partner-notices");
    await notifyPartner(astrologerId, { kind: "system", title, body, link: "/astrologer/remedies" });
  } catch { /* never block money flow on a notification */ }
}

/* ============================================================ *
 * Catalogue (what can be suggested)
 * ============================================================ */

type Item = Omit<RemedyCatalogItem, "commissionPaise">;

async function productItem(id: string): Promise<Item | null> {
  const { productService } = await import("@/modules/products");
  const r = await productService.getById(id);
  if (!r.ok) return null;
  const p = r.value;
  if ((p.status ?? "active") !== "active" || !isVisibleOn(p.channels, "app")) return null;
  return {
    kind: "product", id: p.id, slug: p.slug, name: p.name, image: p.image || p.images?.[0] || "",
    price: p.price, mrp: p.mrp && p.mrp > p.price ? p.mrp : null,
    tag: p.attributes?.planet ? `For ${p.attributes.planet}` : String(p.category ?? ""),
    inStock: p.inStock !== false && (p.stockQty === undefined || p.stockQty > 0 || Boolean((p as { allowBackorder?: boolean }).allowBackorder)),
  };
}

type PoojaLike = { id: string; slug: string; title: string; coverImage: string; deity: string; type: string; packages: { price: number; mrp?: number | null; active: boolean }[]; status: string; channels: unknown };
function poojaToItem(p: PoojaLike): Item | null {
  if (p.status !== "active" || !isVisibleOn(p.channels, "app")) return null;
  const cheapest = p.packages.filter((x) => x.active).sort((a, b) => a.price - b.price)[0];
  if (!cheapest) return null;
  return {
    kind: "pooja", id: p.id, slug: p.slug, name: p.title, image: p.coverImage || "",
    price: cheapest.price, mrp: cheapest.mrp && cheapest.mrp > cheapest.price ? cheapest.mrp : null,
    tag: p.type === "havan" ? "Havan" : p.deity ? `Pooja · ${p.deity}` : "Pooja", inStock: true,
  };
}

async function poojaItem(id: string): Promise<Item | null> {
  const { poojaService } = await import("@/modules/poojas");
  const r = await poojaService.get(id);
  return r.ok ? poojaToItem(r.value as unknown as PoojaLike) : null;
}

async function catalog(f: { q?: string; kind?: RemedyKind }): Promise<{ items: RemedyCatalogItem[]; rules: RemedyRules }> {
  const r = await rules();
  const q = (f.q ?? "").trim().toLowerCase();
  const out: Item[] = [];
  if (r.allowProducts && f.kind !== "pooja") {
    const { productService } = await import("@/modules/products");
    const all = await productService.list();
    for (const p of all.ok ? all.value : []) {
      if ((p.status ?? "active") !== "active" || !isVisibleOn(p.channels, "app")) continue;
      if (q && !`${p.name} ${p.attributes?.planet ?? ""} ${p.attributes?.stone ?? ""} ${(p.tags ?? []).join(" ")}`.toLowerCase().includes(q)) continue;
      const it = await productItem(p.id).catch(() => null);
      if (it) out.push(it);
      if (out.length >= 60) break;
    }
  }
  if (r.allowPoojas && f.kind !== "product") {
    const { poojaService } = await import("@/modules/poojas");
    for (const p of await poojaService.listPublic("app")) {
      if (q && !`${p.title} ${p.deity} ${(p.tags ?? []).join(" ")}`.toLowerCase().includes(q)) continue;
      const it = poojaToItem(p as unknown as PoojaLike);
      if (it) out.push(it);
    }
  }
  return {
    rules: r,
    items: out.slice(0, 80).map((it) => ({ ...it, commissionPaise: commissionFor(Math.round(it.price * 100), r.commissionPct, r.maxCommissionPaise) })),
  };
}

/* ============================================================ *
 * Suggest in chat
 * ============================================================ */

async function suggest(astrologerId: string, sessionId: string, input: { kind: RemedyKind; itemId: string; note?: string; clientId: string }): Promise<Result<{ suggestion: RemedySuggestion; message: ConsultMessage }>> {
  if (!isOid(sessionId)) return fail(AppErrors.notFound("Chat not found"));
  const { RemedySuggestionModel } = await M();
  const again = await RemedySuggestionModel.findOne({ sessionId, clientId: input.clientId }).lean<Doc>();
  if (again && again.astrologerId === astrologerId && again.msgSeq !== null) {
    const { ConsultMessageModel } = await import("@/modules/consultations/consult.model");
    const m = await ConsultMessageModel.findOne({ sessionId, seq: again.msgSeq }).lean<Doc>();
    if (m) return ok({ suggestion: sugOut(again), message: { id: String(m._id), seq: m.seq as number, from: "astrologer", text: m.text as string, masked: false, at: m.at as string, clientId: input.clientId, card: m.card as ConsultCard } });
  }

  const r = await rules();
  if (!r.enabled) return fail(AppErrors.validation("Remedy suggestions are turned off right now."));
  if (input.kind === "product" && !r.allowProducts) return fail(AppErrors.validation("Shop products cannot be suggested right now."));
  if (input.kind === "pooja" && !r.allowPoojas) return fail(AppErrors.validation("Poojas cannot be suggested right now."));

  const { ConsultSessionModel } = await import("@/modules/consultations/consult.model");
  const s = await ConsultSessionModel.findById(sessionId).lean<Doc>();
  if (!s || s.astrologerId !== astrologerId) return fail(AppErrors.notFound("Chat not found"));
  if (s.status !== "active") return fail(AppErrors.validation("You can suggest a remedy only during a live chat.", { reason: "NOT_ACTIVE" }));

  const count = await RemedySuggestionModel.countDocuments({ sessionId });
  if (count >= r.maxPerChat) return fail(AppErrors.validation(`You can suggest up to ${r.maxPerChat} items in one chat.`, { reason: "MAX" }));
  if (await RemedySuggestionModel.exists({ sessionId, kind: input.kind, itemId: input.itemId })) return fail(AppErrors.conflict("You already suggested this in this chat.", { reason: "DUPLICATE" }));

  const item = input.kind === "product" ? await productItem(input.itemId) : await poojaItem(input.itemId);
  if (!item) return fail(AppErrors.notFound("This item is not available in the app any more."));
  if (!item.inStock) return fail(AppErrors.validation(`${item.name} is out of stock. Suggest something else.`, { reason: "OUT_OF_STOCK" }));

  const { maskContacts } = await import("@/modules/consultations/consult.mask");
  const note = maskContacts((input.note ?? "").trim().slice(0, 300)).text;
  const at = nowIso();
  const customer = (s.customer as { name?: string }) ?? {};
  const astro = (s.astrologer as { name?: string }) ?? {};
  let doc: Doc;
  try {
    const d = await RemedySuggestionModel.create({
      sessionId, sessionNumber: s.sessionNumber, astrologerId, astrologerName: astro.name ?? "Astrologer",
      customerId: s.customerId, customerName: customer.name ?? "Customer",
      kind: item.kind, itemId: item.id, slug: item.slug, name: item.name, image: item.image, price: item.price, mrp: item.mrp, note,
      commissionPct: r.commissionPct, maxCommissionPaise: r.maxCommissionPaise, clientId: input.clientId, msgSeq: null,
      at, expiresAt: new Date(Date.parse(at) + r.attributionDays * DAY).toISOString(), sales: 0,
    });
    doc = d.toObject() as Doc;
  } catch (e) {
    if (isDup(e, "clientId")) return fail(AppErrors.conflict("Please try again."));
    if (isDup(e, "itemId")) return fail(AppErrors.conflict("You already suggested this in this chat.", { reason: "DUPLICATE" }));
    throw e;
  }

  const card: ConsultCard = { type: "remedy", id: String(doc._id), kind: item.kind, itemId: item.id, slug: item.slug, name: item.name, image: item.image, price: item.price, mrp: item.mrp, note };
  const { consultService } = await import("@/modules/consultations");
  const sent = await consultService.send({ astrologerId }, sessionId, `Suggested ${item.kind === "pooja" ? "pooja" : "remedy"}: ${item.name}${note ? `\n${note}` : ""}`, input.clientId, card);
  if (!sent.ok) {
    // The chat closed in between: the card was never shown, so nothing is promised.
    await RemedySuggestionModel.deleteOne({ _id: doc._id });
    return fail(sent.error);
  }
  await RemedySuggestionModel.updateOne({ _id: doc._id }, { $set: { msgSeq: sent.value.seq } });
  return ok({ suggestion: sugOut({ ...doc, msgSeq: sent.value.seq }), message: sent.value });
}

async function forSession(sessionId: string): Promise<RemedySuggestion[]> {
  if (!isOid(sessionId)) return [];
  const { RemedySuggestionModel } = await M();
  return (await RemedySuggestionModel.find({ sessionId, msgSeq: { $ne: null } }).sort({ at: 1 }).lean<Doc[]>()).map(sugOut);
}

/** Customer: what astrologers suggested (newest first, last 90 days). */
async function forCustomer(customerId: string): Promise<(RemedySuggestion & { open: boolean })[]> {
  const { RemedySuggestionModel } = await M();
  const since = new Date(Date.now() - 90 * DAY).toISOString();
  const now = nowIso();
  const rows = await RemedySuggestionModel.find({ customerId, at: { $gte: since }, msgSeq: { $ne: null } }).sort({ at: -1 }).limit(100).lean<Doc[]>();
  return rows.map((d) => {
    const s = sugOut(d);
    // The customer never sees commission numbers.
    return { ...s, commissionPct: 0, maxCommissionPaise: 0, open: s.expiresAt > now };
  });
}

/* ============================================================ *
 * Sales: attribution + reconcile (the sweep)
 * ============================================================ */

function push(status: RemedySale["history"][number]["status"], note: string, by = "System") {
  return { $push: { history: { at: nowIso(), status, note, by } } };
}

/** Find purchases of suggested items and record them as sales. Idempotent. */
async function attribute(now = Date.now()): Promise<number> {
  const { RemedySuggestionModel, RemedySaleModel } = await M();
  const sugs = (await RemedySuggestionModel.find({ expiresAt: { $gte: new Date(now - LATE_GRACE_MS).toISOString() }, msgSeq: { $ne: null } }).limit(5000).lean<Doc[]>()).map(sugOut);
  if (!sugs.length) return 0;
  const byCustomer = new Map<string, RemedySuggestion[]>();
  for (const s of sugs) byCustomer.set(s.customerId, [...(byCustomer.get(s.customerId) ?? []), s]);

  const { OrderModel } = await import("@/modules/orders/order.model");
  const { PoojaBookingModel } = await import("@/modules/poojas/pooja.model");
  /** Last-touch: the newest suggestion of this item made before the purchase and still open at that time. */
  const pick = (list: RemedySuggestion[], kind: RemedyKind, itemId: string, atIso: string) =>
    list.filter((s) => s.kind === kind && s.itemId === itemId && s.at <= atIso && atIso <= s.expiresAt).sort((a, b) => (a.at < b.at ? 1 : -1))[0];

  let created = 0;
  const make = async (s: RemedySuggestion, key: string, f: { itemName: string; image: string; source: RemedySale["source"]; qty: number; basePaise: number; boughtAt: string }) => {
    if (f.basePaise <= 0) return;
    const commission = commissionFor(f.basePaise, s.commissionPct, s.maxCommissionPaise);
    if (commission <= 0) return;
    try {
      await RemedySaleModel.create({
        key, suggestionId: s.id, sessionId: s.sessionId, sessionNumber: s.sessionNumber, astrologerId: s.astrologerId, astrologerName: s.astrologerName,
        customerId: s.customerId, customerName: s.customerName, kind: s.kind, itemId: s.itemId, itemName: f.itemName, image: f.image,
        source: f.source, qty: f.qty, basePaise: f.basePaise, commissionPct: s.commissionPct, commissionPaise: commission,
        status: "pending", confirmAt: null, confirmedAt: null, ledgerAt: null, reversedAt: null, reason: "", boughtAt: f.boughtAt, createdAt: nowIso(),
        history: [{ at: nowIso(), status: "attributed", note: `${f.source.kind === "order" ? "Order" : "Booking"} ${f.source.number} · ${inr(f.basePaise)} · ${s.commissionPct}%`, by: "System" }],
      });
      created++;
      await RemedySuggestionModel.updateOne({ _id: s.id }, { $inc: { sales: 1 } });
      await notify(s.astrologerId, "Your suggestion was bought", `${s.customerName} bought ${f.itemName}. Commission ${inr(commission)} is confirmed after ${f.source.kind === "order" ? "delivery" : "the pooja"} and the return window.`);
    } catch (e) {
      if (!isDup(e, "key")) throw e;
    }
  };

  for (const [customerId, list] of byCustomer) {
    const minAt = list.reduce((m, s) => (s.at < m ? s.at : m), list[0].at);
    const products = [...new Set(list.filter((s) => s.kind === "product").map((s) => s.itemId))];
    const poojas = [...new Set(list.filter((s) => s.kind === "pooja").map((s) => s.itemId))];
    if (products.length) {
      const orders = await OrderModel.find({ customerId, placedAt: { $gte: minAt }, status: { $in: ORDER_BOUGHT }, isDeleted: { $ne: true }, "items.productId": { $in: products } }).limit(200).lean<Doc[]>();
      for (const o of orders) {
        const placedAt = o.placedAt as string;
        const items = (o.items as { productId: string; name: string; image?: string; qty: number; lineTotal: number }[]) ?? [];
        const pricing = (o.pricing as { subtotal?: number; discount?: number }) ?? {};
        const share = pricing.subtotal && pricing.subtotal > 0 ? Math.max(0, 1 - (pricing.discount ?? 0) / pricing.subtotal) : 1;
        for (const pid of new Set(items.map((i) => i.productId))) {
          const s = pick(list, "product", pid, placedAt);
          if (!s) continue;
          const lines = items.filter((i) => i.productId === pid);
          const gross = lines.reduce((n, i) => n + (i.lineTotal ?? 0), 0);
          await make(s, `order:${String(o._id)}:${pid}`, {
            itemName: lines[0].name || s.name, image: lines[0].image || s.image,
            source: { kind: "order", id: String(o._id), number: o.orderNumber as string },
            qty: lines.reduce((n, i) => n + (i.qty ?? 0), 0), basePaise: Math.floor(gross * share * 100), boughtAt: placedAt,
          });
        }
      }
    }
    if (poojas.length) {
      const bookings = await PoojaBookingModel.find({ "customer.customerId": customerId, poojaId: { $in: poojas }, status: { $nin: ["pending_payment", "cancelled"] }, "payment.status": { $in: ["paid", "partially_refunded"] } }).limit(200).lean<Doc[]>();
      for (const b of bookings) {
        const pay = (b.payment as { paidAt?: string | null; refunded?: number }) ?? {};
        const created_ = b.createdAt instanceof Date ? b.createdAt.toISOString() : String(b.createdAt ?? "");
        const boughtAt = pay.paidAt || created_;
        if (!boughtAt || boughtAt < minAt) continue;
        const s = pick(list, "pooja", b.poojaId as string, boughtAt);
        if (!s) continue;
        const total = ((b.pricing as { total?: number }) ?? {}).total ?? 0;
        await make(s, `pooja:${String(b._id)}`, {
          itemName: ((b.pooja as { title?: string }) ?? {}).title || s.name, image: ((b.pooja as { image?: string }) ?? {}).image || s.image,
          source: { kind: "pooja_booking", id: String(b._id), number: b.bookingNumber as string },
          qty: 1, basePaise: Math.floor(Math.max(0, total - (pay.refunded ?? 0)) * 100), boughtAt,
        });
      }
    }
  }
  return created;
}

async function reverse(sale: RemedySale, reason: string, by: string): Promise<boolean> {
  const { RemedySaleModel } = await M();
  const at = nowIso();
  const done = await RemedySaleModel.findOneAndUpdate(
    { _id: sale.id, status: sale.status },
    { $set: { status: "reversed", reversedAt: at, reason }, ...push("reversed", reason, by) },
    { new: true },
  ).lean<Doc>();
  if (!done) return false;
  if (sale.status === "confirmed") {
    const { earningsLedger } = await import("@/modules/earnings");
    await earningsLedger.remedyReversal({ saleId: sale.id, astrologerId: sale.astrologerId, commissionPaise: sale.commissionPaise, label: `Remedy sale reversed · ${sale.itemName}`, note: reason, actor: by });
    await notify(sale.astrologerId, "Remedy commission reversed", `${inr(sale.commissionPaise)} for ${sale.itemName} was taken back: ${reason}`);
  }
  return true;
}

async function confirm(sale: RemedySale): Promise<boolean> {
  const { RemedySaleModel } = await M();
  const at = nowIso();
  const done = await RemedySaleModel.findOneAndUpdate(
    { _id: sale.id, status: "pending" },
    { $set: { status: "confirmed", confirmedAt: at }, ...push("confirmed", `Commission ${inr(sale.commissionPaise)} added to earnings`) },
    { new: true },
  ).lean<Doc>();
  if (!done) return false;
  await writeLedger(saleOut(done));
  await notify(sale.astrologerId, "Remedy commission confirmed", `${inr(sale.commissionPaise)} for ${sale.itemName} is now in your earnings.`);
  return true;
}

async function writeLedger(sale: RemedySale) {
  const { earningsLedger } = await import("@/modules/earnings");
  await earningsLedger.remedy({
    saleId: sale.id, astrologerId: sale.astrologerId, basePaise: sale.basePaise, commissionPaise: sale.commissionPaise,
    label: `Remedy sale · ${sale.itemName} · ${sale.source.kind === "order" ? "order" : "booking"} ${sale.source.number}`,
    note: `${sale.commissionPct}% of ${inr(sale.basePaise)} · suggested in chat ${sale.sessionNumber}`, at: sale.confirmedAt ?? nowIso(),
  });
  const { RemedySaleModel } = await M();
  await RemedySaleModel.updateOne({ _id: sale.id }, { $set: { ledgerAt: nowIso() } });
}

/** Bring one sale in line with its order / booking. Returns what happened. */
async function reconcileOne(sale: RemedySale, confirmAfterDays: number, now = Date.now()): Promise<"confirmed" | "reversed" | "updated" | null> {
  const { RemedySaleModel } = await M();
  const due = (fromIso: string) => new Date(Date.parse(fromIso) + confirmAfterDays * DAY).toISOString();
  if (sale.source.kind === "order") {
    const { OrderModel } = await import("@/modules/orders/order.model");
    const o = isOid(sale.source.id) ? await OrderModel.findById(sale.source.id).lean<Doc>() : null;
    if (!o || o.isDeleted || o.status === "cancelled" || o.status === "refunded" || o.paymentStatus === "refunded") {
      const why = !o || o.isDeleted ? "Order removed" : o.status === "cancelled" ? "Order cancelled" : "Order refunded";
      return (await reverse(sale, why, "System")) ? "reversed" : null;
    }
    if (sale.status !== "pending") return null;
    if (o.status === "delivered") {
      const deliveredAt = ((o.fulfillment as { deliveredAt?: string }) ?? {}).deliveredAt || new Date(now).toISOString();
      const confirmAt = sale.confirmAt ?? due(deliveredAt);
      if (Date.parse(confirmAt) <= now) return (await confirm({ ...sale, confirmAt })) ? "confirmed" : null;
      if (!sale.confirmAt) {
        await RemedySaleModel.updateOne({ _id: sale.id, status: "pending" }, { $set: { confirmAt }, ...push("updated", `Delivered. Confirms on ${confirmAt.slice(0, 10)}`) });
        return "updated";
      }
    }
    return null;
  }
  const { PoojaBookingModel } = await import("@/modules/poojas/pooja.model");
  const b = isOid(sale.source.id) ? await PoojaBookingModel.findById(sale.source.id).lean<Doc>() : null;
  const pay = (b?.payment as { status?: string; refunded?: number }) ?? {};
  if (!b || b.status === "cancelled" || pay.status === "refunded") {
    return (await reverse(sale, !b ? "Booking removed" : b.status === "cancelled" ? "Booking cancelled" : "Booking refunded", "System")) ? "reversed" : null;
  }
  if (sale.status !== "pending") return null;
  // A part refund lowers what the customer paid, so the commission follows it.
  const total = ((b.pricing as { total?: number }) ?? {}).total ?? 0;
  const base = Math.floor(Math.max(0, total - (pay.refunded ?? 0)) * 100);
  let cur = sale;
  if (base !== sale.basePaise) {
    const { RemedySuggestionModel } = await M();
    const s = await RemedySuggestionModel.findById(sale.suggestionId).lean<Doc>();
    const commission = commissionFor(base, sale.commissionPct, (s?.maxCommissionPaise as number) ?? 0);
    if (commission <= 0) return (await reverse(sale, "Booking refunded", "System")) ? "reversed" : null;
    await RemedySaleModel.updateOne({ _id: sale.id, status: "pending" }, { $set: { basePaise: base, commissionPaise: commission }, ...push("updated", `Part refund: now ${inr(base)} · commission ${inr(commission)}`) });
    cur = { ...sale, basePaise: base, commissionPaise: commission };
  }
  if (BOOKING_DONE.includes(b.status as string)) {
    const confirmAt = cur.confirmAt ?? due(new Date(now).toISOString());
    if (Date.parse(confirmAt) <= now) return (await confirm({ ...cur, confirmAt })) ? "confirmed" : null;
    if (!cur.confirmAt) {
      await RemedySaleModel.updateOne({ _id: sale.id, status: "pending" }, { $set: { confirmAt }, ...push("updated", `Pooja done. Confirms on ${confirmAt.slice(0, 10)}`) });
      return "updated";
    }
  }
  return cur !== sale ? "updated" : null;
}

async function sweep(): Promise<{ attributed: number; confirmed: number; reversed: number; ledger: number }> {
  const st = await astroSettingsService.get();
  const res = { attributed: await attribute(), confirmed: 0, reversed: 0, ledger: 0 };
  const { RemedySaleModel } = await M();
  const watchFrom = new Date(Date.now() - WATCH_CONFIRMED_MS).toISOString();
  const rows = await RemedySaleModel.find({ $or: [{ status: "pending" }, { status: "confirmed", confirmedAt: { $gte: watchFrom } }] }).limit(2000).lean<Doc[]>();
  for (const d of rows) {
    const sale = saleOut(d);
    const r = await reconcileOne(sale, st.remedy.confirmAfterDays).catch(() => null);
    if (r === "confirmed") res.confirmed++;
    if (r === "reversed") res.reversed++;
  }
  // A confirm whose ledger write failed: write it now (unique key, safe to repeat).
  for (const d of await RemedySaleModel.find({ status: "confirmed", ledgerAt: null }).limit(500).lean<Doc[]>()) {
    await writeLedger(saleOut(d)).then(() => { res.ledger++; }).catch(() => undefined);
  }
  return res;
}

let lastSweep = 0;
let sweeping: Promise<unknown> | null = null;
/** Run the sweep in the background at most once a minute (pages that show sales call this). */
function maybeSweep(everyMs = 60_000): void {
  if (sweeping || Date.now() - lastSweep < everyMs) return;
  lastSweep = Date.now();
  sweeping = sweep().catch(() => undefined).finally(() => { sweeping = null; });
}

/* ============================================================ *
 * Lists
 * ============================================================ */

async function stats(match: Record<string, unknown>): Promise<RemedyStats> {
  const { RemedySaleModel, RemedySuggestionModel } = await M();
  const rows = await RemedySaleModel.aggregate([{ $match: match }, { $group: { _id: "$status", n: { $sum: 1 }, sum: { $sum: "$commissionPaise" } } }]);
  const by = Object.fromEntries((rows as { _id: string; n: number; sum: number }[]).map((r) => [r._id, r]));
  const sugMatch = match.astrologerId ? { astrologerId: match.astrologerId, msgSeq: { $ne: null } } : { msgSeq: { $ne: null } };
  return {
    sales: (by.pending?.n ?? 0) + (by.confirmed?.n ?? 0) + (by.reversed?.n ?? 0),
    pendingPaise: by.pending?.sum ?? 0,
    confirmedPaise: by.confirmed?.sum ?? 0,
    reversedPaise: by.reversed?.sum ?? 0,
    suggestions: await RemedySuggestionModel.countDocuments(sugMatch),
  };
}

async function listSales(match: Record<string, unknown>, status: string | undefined, before: string | undefined, limit = 50): Promise<{ items: RemedySale[]; nextBefore: string | null }> {
  const { RemedySaleModel } = await M();
  const q: Record<string, unknown> = { ...match };
  if (status === "waiting") Object.assign(q, { status: "pending", confirmAt: null });
  else if (status === "in_window") Object.assign(q, { status: "pending", confirmAt: { $ne: null } });
  else if (status && ["pending", "confirmed", "reversed"].includes(status)) q.status = status as RemedySaleStatus;
  if (before) q.createdAt = { $lt: before };
  const rows = await RemedySaleModel.find(q).sort({ createdAt: -1 }).limit(limit + 1).lean<Doc[]>();
  const items = rows.slice(0, limit).map(saleOut);
  return { items, nextBefore: rows.length > limit ? items[items.length - 1].createdAt : null };
}

async function partner(astrologerId: string, f: { status?: string; before?: string }) {
  maybeSweep();
  const { RemedySuggestionModel } = await M();
  const recent = (await RemedySuggestionModel.find({ astrologerId, msgSeq: { $ne: null } }).sort({ at: -1 }).limit(20).lean<Doc[]>()).map(sugOut);
  return { rules: await rules(), stats: await stats({ astrologerId }), ...(await listSales({ astrologerId }, f.status, f.before)), recent };
}

async function adminList(f: { status?: string; astrologerId?: string; before?: string }) {
  maybeSweep();
  const match = f.astrologerId ? { astrologerId: f.astrologerId } : {};
  return { rules: await rules(), stats: await stats(match), ...(await listSales(match, f.status, f.before, 100)) };
}

/** Admin: take a commission back (pending or confirmed), with a reason. */
async function adminReverse(id: string, reason: string, adminName: string): Promise<Result<RemedySale>> {
  if (!isOid(id)) return fail(AppErrors.notFound("Sale not found"));
  const why = reason.trim();
  if (why.length < 5) return fail(AppErrors.validation("Give a reason (at least 5 characters)"));
  const { RemedySaleModel } = await M();
  const d = await RemedySaleModel.findById(id).lean<Doc>();
  if (!d) return fail(AppErrors.notFound("Sale not found"));
  const sale = saleOut(d);
  if (sale.status === "reversed") return ok(sale);
  if (!(await reverse(sale, `By AstroUnkle: ${why}`, adminName))) return fail(AppErrors.conflict("This sale was just updated. Reload and try again."));
  if (sale.status === "pending") await notify(sale.astrologerId, "Remedy sale not counted", `${sale.itemName} (${sale.source.number}) will not earn a commission: ${why}`);
  await auditService.record({ action: "update", entity: "payout", entityId: sale.id, entityLabel: sale.source.number, summary: `Remedy commission reversed for ${sale.astrologerName} · ${sale.itemName} · ${inr(sale.commissionPaise)}: ${why}`, actor: adminName }).catch(() => undefined);
  return ok(saleOut((await RemedySaleModel.findById(id).lean<Doc>())!));
}

export const remedyService = { rules, catalog, suggest, forSession, forCustomer, sweep, maybeSweep, partner, adminList, adminReverse, reconcileOne, attribute };
