import "server-only";

/**
 * Wallet repository — the ONLY code that changes balances.
 *
 * `apply()` is the single primitive. It runs inside a MongoDB transaction:
 *   1. insert the ledger row (unique `key`) → a duplicate key means this exact
 *      operation was already applied → return "duplicate" (idempotent)
 *   2. update the balance, guarded so it can never go below zero
 * Either both happen or neither does, so a crash can never leave the ledger
 * and the balance out of sync. Atlas clusters are replica sets, so
 * transactions are available.
 *
 * Debits spend PROMO first, then CASH (bonus never becomes refundable cash).
 *
 * Mock implementation: single-threaded and synchronous between read and
 * write, so it is atomic too. Switch with DATA_SOURCE_WALLETS=mongo.
 */

import { dataSourceFor } from "@/core/config/env";
import { newId } from "@/core/id";
import type { WalletBalance, WalletRecharge, WalletTxn, WalletTxnType } from "./wallet.types";

export interface ApplyOp {
  key: string;
  customerId: string;
  type: WalletTxnType;
  /** Explicit bucket deltas (credits, refunds, admin adjustments). */
  cashPaise?: number;
  promoPaise?: number;
  /** Debit this many paise, promo first (consultation charges). Mutually exclusive with explicit deltas. */
  debitPaise?: number;
  ref?: string;
  note: string;
  actor: string;
}
export type ApplyResult =
  | { status: "applied"; txn: WalletTxn; balance: WalletBalance }
  | { status: "duplicate"; txn: WalletTxn | null; balance: WalletBalance }
  | { status: "insufficient"; balance: WalletBalance };

export interface TxnPage { items: WalletTxn[]; nextCursor: string | null }

export interface WalletRepository {
  balance(customerId: string): Promise<WalletBalance>;
  apply(op: ApplyOp): Promise<ApplyResult>;
  txns(customerId: string, opts: { limit: number; cursor?: string; type?: WalletTxnType }): Promise<TxnPage>;
  txnsByRef(ref: string): Promise<WalletTxn[]>;
  findTxn(key: string): Promise<WalletTxn | null>;
  createRecharge(r: Omit<WalletRecharge, "id" | "createdAt" | "status">): Promise<WalletRecharge>;
  attachOrder(rechargeId: string, razorpayOrderId: string): Promise<void>;
  rechargeByOrder(razorpayOrderId: string): Promise<WalletRecharge | null>;
  /** Mark paid ONCE. Returns null if it was already paid (or not found). */
  markRechargePaid(razorpayOrderId: string, razorpayPaymentId: string | undefined): Promise<WalletRecharge | null>;
  rechargesFor(customerId: string, limit: number): Promise<WalletRecharge[]>;
}

/** Split a debit across buckets: promo first. */
export function splitDebit(cash: number, promo: number, amount: number) {
  const fromPromo = Math.min(promo, amount);
  return { promo: -fromPromo, cash: -(amount - fromPromo) };
}

function validate(op: ApplyOp) {
  const ints = [op.cashPaise ?? 0, op.promoPaise ?? 0, op.debitPaise ?? 0];
  if (!ints.every(Number.isSafeInteger)) throw new Error("Wallet amounts must be integer paise");
  if (op.debitPaise !== undefined && (op.debitPaise <= 0 || op.cashPaise || op.promoPaise)) throw new Error("Invalid debit");
  if (op.debitPaise === undefined && !(op.cashPaise || op.promoPaise)) throw new Error("Empty wallet operation");
  if (!op.key || op.key.length > 200) throw new Error("Invalid idempotency key");
}

/* ------------------------------------------------------------------ *
 * Mock
 * ------------------------------------------------------------------ */
interface Mem { wallets: Map<string, WalletBalance>; txns: WalletTxn[]; keys: Set<string>; recharges: WalletRecharge[] }
declare global {
  var __walletMem: Mem | undefined;
}
const mem: Mem = global.__walletMem ?? { wallets: new Map(), txns: [], keys: new Set(), recharges: [] };
global.__walletMem = mem;
const nowIso = () => new Date().toISOString();
const emptyBal = (customerId: string): WalletBalance => ({ customerId, cashPaise: 0, promoPaise: 0, updatedAt: nowIso() });

const mockRepo: WalletRepository = {
  async balance(customerId) { return { ...(mem.wallets.get(customerId) ?? emptyBal(customerId)) }; },
  async apply(op) {
    validate(op);
    const bal = mem.wallets.get(op.customerId) ?? emptyBal(op.customerId);
    if (mem.keys.has(op.key)) return { status: "duplicate", txn: mem.txns.find((t) => t.key === op.key) ?? null, balance: { ...bal } };
    const d = op.debitPaise !== undefined ? splitDebit(bal.cashPaise, bal.promoPaise, op.debitPaise) : { cash: op.cashPaise ?? 0, promo: op.promoPaise ?? 0 };
    if (op.debitPaise !== undefined && bal.cashPaise + bal.promoPaise < op.debitPaise) return { status: "insufficient", balance: { ...bal } };
    if (bal.cashPaise + d.cash < 0 || bal.promoPaise + d.promo < 0) return { status: "insufficient", balance: { ...bal } };
    const next: WalletBalance = { customerId: op.customerId, cashPaise: bal.cashPaise + d.cash, promoPaise: bal.promoPaise + d.promo, updatedAt: nowIso() };
    const txn: WalletTxn = { id: newId("wtx"), key: op.key, customerId: op.customerId, type: op.type, cashPaise: d.cash, promoPaise: d.promo, cashAfter: next.cashPaise, promoAfter: next.promoPaise, ref: op.ref, note: op.note, actor: op.actor, at: next.updatedAt };
    mem.wallets.set(op.customerId, next);
    mem.keys.add(op.key);
    mem.txns.unshift(txn);
    return { status: "applied", txn: { ...txn }, balance: { ...next } };
  },
  async txns(customerId, { limit, cursor, type }) {
    const all = mem.txns.filter((t) => t.customerId === customerId && (!type || t.type === type));
    const start = cursor ? all.findIndex((t) => t.id === cursor) + 1 : 0;
    const items = all.slice(start, start + limit);
    return { items: items.map((t) => ({ ...t })), nextCursor: start + limit < all.length ? items[items.length - 1]?.id ?? null : null };
  },
  async txnsByRef(ref) { return mem.txns.filter((t) => t.ref === ref).map((t) => ({ ...t })); },
  async findTxn(key) { const t = mem.txns.find((x) => x.key === key); return t ? { ...t } : null; },
  async createRecharge(r) { const row: WalletRecharge = { ...r, id: newId("wrc"), status: "created", createdAt: nowIso() }; mem.recharges.unshift(row); return { ...row }; },
  async attachOrder(id, orderId) { const r = mem.recharges.find((x) => x.id === id); if (r) r.razorpayOrderId = orderId; },
  async rechargeByOrder(orderId) { const r = mem.recharges.find((x) => x.razorpayOrderId === orderId); return r ? { ...r } : null; },
  async markRechargePaid(orderId, paymentId) {
    const r = mem.recharges.find((x) => x.razorpayOrderId === orderId);
    if (!r || r.status === "paid") return null;
    r.status = "paid"; if (paymentId) r.razorpayPaymentId = paymentId; r.paidAt = nowIso();
    return { ...r };
  },
  async rechargesFor(customerId, limit) { return mem.recharges.filter((r) => r.customerId === customerId).slice(0, limit).map((r) => ({ ...r })); },
};

/* ------------------------------------------------------------------ *
 * Mongo
 * ------------------------------------------------------------------ */
async function models() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  const m = await import("./wallet.model");
  const mongoose = await connectMongoose();
  return { ...m, mongoose };
}
type Row = Record<string, unknown>;
const txnFrom = (d: Row): WalletTxn => ({
  id: String(d._id), key: d.key as string, customerId: d.customerId as string, type: d.type as WalletTxnType,
  cashPaise: d.cashPaise as number, promoPaise: d.promoPaise as number, cashAfter: d.cashAfter as number, promoAfter: d.promoAfter as number,
  ref: (d.ref as string) ?? undefined, note: d.note as string, actor: d.actor as string, at: d.at as string,
});
const balFrom = (customerId: string, d: Row | null): WalletBalance => ({
  customerId, cashPaise: (d?.cashPaise as number) ?? 0, promoPaise: (d?.promoPaise as number) ?? 0,
  updatedAt: d?.updatedAt instanceof Date ? d.updatedAt.toISOString() : nowIso(),
});
const rechargeFrom = (d: Row): WalletRecharge => ({
  id: String(d._id), customerId: d.customerId as string, amountPaise: d.amountPaise as number, bonusPaise: d.bonusPaise as number,
  gstPaise: d.gstPaise as number, payablePaise: d.payablePaise as number, status: d.status as WalletRecharge["status"],
  razorpayOrderId: (d.razorpayOrderId as string) ?? undefined, razorpayPaymentId: (d.razorpayPaymentId as string) ?? undefined,
  createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : nowIso(), paidAt: (d.paidAt as string) ?? undefined,
});
const isDup = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: number }).code === 11000;

const mongoRepo: WalletRepository = {
  async balance(customerId) {
    const { WalletModel } = await models();
    return balFrom(customerId, await WalletModel.findOne({ customerId }).lean<Row>());
  },

  async apply(op) {
    validate(op);
    const { WalletModel, WalletTxnModel, mongoose } = await models();
    // Make sure the wallet row exists (outside the txn; upsert is idempotent).
    await WalletModel.updateOne({ customerId: op.customerId }, { $setOnInsert: { customerId: op.customerId, cashPaise: 0, promoPaise: 0 } }, { upsert: true }).catch((e) => { if (!isDup(e)) throw e; });

    const session = await mongoose.startSession();
    let result: ApplyResult | null = null;
    try {
      await session.withTransaction(async () => {
        result = null;
        const bal = await WalletModel.findOne({ customerId: op.customerId }).session(session).lean<Row>();
        const cash = (bal?.cashPaise as number) ?? 0;
        const promo = (bal?.promoPaise as number) ?? 0;
        const d = op.debitPaise !== undefined ? splitDebit(cash, promo, op.debitPaise) : { cash: op.cashPaise ?? 0, promo: op.promoPaise ?? 0 };
        if ((op.debitPaise !== undefined && cash + promo < op.debitPaise) || cash + d.cash < 0 || promo + d.promo < 0) {
          // Already applied earlier? Then it is a duplicate, not "insufficient".
          const prev = await WalletTxnModel.findOne({ key: op.key }).session(session).lean<Row>();
          result = prev ? { status: "duplicate", txn: txnFrom(prev), balance: balFrom(op.customerId, bal) } : { status: "insufficient", balance: balFrom(op.customerId, bal) };
          return;
        }
        const at = nowIso();
        try {
          const [row] = await WalletTxnModel.create([{
            key: op.key, customerId: op.customerId, type: op.type, cashPaise: d.cash, promoPaise: d.promo,
            cashAfter: cash + d.cash, promoAfter: promo + d.promo, ref: op.ref ?? null, note: op.note, actor: op.actor, at,
          }], { session });
          // Guard on the values we read: a concurrent change aborts + retries the txn.
          const upd = await WalletModel.updateOne({ customerId: op.customerId, cashPaise: cash, promoPaise: promo }, { $inc: { cashPaise: d.cash, promoPaise: d.promo } }, { session });
          if (upd.modifiedCount !== 1) throw Object.assign(new Error("Wallet changed concurrently"), { errorLabels: ["TransientTransactionError"] });
          result = { status: "applied", txn: txnFrom(row.toObject() as Row), balance: { customerId: op.customerId, cashPaise: cash + d.cash, promoPaise: promo + d.promo, updatedAt: at } };
        } catch (e) {
          if (!isDup(e)) throw e;
          result = { status: "duplicate", txn: null, balance: balFrom(op.customerId, bal) };
          throw Object.assign(new Error("duplicate"), { __dup: true });
        }
      });
    } catch (e) {
      if (!(e as { __dup?: boolean }).__dup) throw e;
    } finally {
      await session.endSession();
    }
    const r = result as ApplyResult | null;
    if (!r) throw new Error("Wallet operation did not complete");
    if (r.status === "duplicate" && !r.txn) {
      const prev = await WalletTxnModel.findOne({ key: op.key }).lean<Row>();
      return { status: "duplicate", txn: prev ? txnFrom(prev) : null, balance: await this.balance(op.customerId) };
    }
    return r;
  },

  async txns(customerId, { limit, cursor, type }) {
    const { WalletTxnModel } = await models();
    const q: Row = { customerId };
    if (type) q.type = type;
    if (cursor && /^[a-f0-9]{24}$/i.test(cursor)) q._id = { $lt: cursor };
    const rows = await WalletTxnModel.find(q).sort({ _id: -1 }).limit(limit + 1).lean<Row[]>();
    const items = rows.slice(0, limit).map(txnFrom);
    return { items, nextCursor: rows.length > limit ? items[items.length - 1].id : null };
  },
  async txnsByRef(ref) {
    const { WalletTxnModel } = await models();
    return (await WalletTxnModel.find({ ref }).sort({ _id: 1 }).lean<Row[]>()).map(txnFrom);
  },
  async findTxn(key) {
    const { WalletTxnModel } = await models();
    const d = await WalletTxnModel.findOne({ key }).lean<Row>();
    return d ? txnFrom(d) : null;
  },
  async createRecharge(r) {
    const { WalletRechargeModel } = await models();
    const d = await WalletRechargeModel.create({ ...r, status: "created" });
    return rechargeFrom(d.toObject() as Row);
  },
  async attachOrder(id, orderId) {
    const { WalletRechargeModel } = await models();
    if (/^[a-f0-9]{24}$/i.test(id)) await WalletRechargeModel.updateOne({ _id: id }, { $set: { razorpayOrderId: orderId } });
  },
  async rechargeByOrder(orderId) {
    const { WalletRechargeModel } = await models();
    const d = await WalletRechargeModel.findOne({ razorpayOrderId: orderId }).lean<Row>();
    return d ? rechargeFrom(d) : null;
  },
  async markRechargePaid(orderId, paymentId) {
    const { WalletRechargeModel } = await models();
    // Atomic "created → paid": only the first caller (webhook or callback) wins.
    const d = await WalletRechargeModel.findOneAndUpdate(
      { razorpayOrderId: orderId, status: { $ne: "paid" } },
      { $set: { status: "paid", paidAt: nowIso(), ...(paymentId ? { razorpayPaymentId: paymentId } : {}) } },
      { returnDocument: "after" },
    ).lean<Row>().catch(async (e) => {
      if (!isDup(e)) throw e;
      // Payment id already used elsewhere (should never happen): still mark paid.
      return WalletRechargeModel.findOneAndUpdate({ razorpayOrderId: orderId, status: { $ne: "paid" } }, { $set: { status: "paid", paidAt: nowIso() } }, { returnDocument: "after" }).lean<Row>();
    });
    return d ? rechargeFrom(d) : null;
  },
  async rechargesFor(customerId, limit) {
    const { WalletRechargeModel } = await models();
    return (await WalletRechargeModel.find({ customerId }).sort({ _id: -1 }).limit(limit).lean<Row[]>()).map(rechargeFrom);
  },
};

export function getWalletRepository(): WalletRepository {
  return dataSourceFor("wallets") === "mongo" ? mongoRepo : mockRepo;
}
