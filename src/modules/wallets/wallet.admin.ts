import "server-only";

/**
 * Admin: wallets across all customers (read only, plus "check with Razorpay").
 * Rows come back with the customer's name / phone / email so the team never
 * has to open customers one by one. Search accepts a name, a phone number, an
 * email, or a Razorpay order / payment id.
 */

import { fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { fetchOrderPayments } from "@/core/razorpay";
import { getWalletRepository, type WalletStats } from "./wallet.repository";
import { walletService, type RechargeStatusView } from "./wallet.service";
import type { WalletRecharge, WalletTxn, WalletTxnType } from "./wallet.types";

export interface CustomerLite { id: string; name: string; phone: string; email: string }
export type AdminRecharge = WalletRecharge & { customer: CustomerLite | null };
export type AdminTxn = WalletTxn & { customer: CustomerLite | null };

const PAGE = 30;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function customerModel() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  const { CustomerModel } = await import("@/modules/customers/customer.model");
  await connectMongoose();
  return CustomerModel;
}

/** Customer ids matching a free-text search (name, email, any phone format). */
async function findCustomerIds(q: string): Promise<string[]> {
  const M = await customerModel();
  const digits = q.replace(/\D/g, "");
  const or: Record<string, unknown>[] = [
    { name: { $regex: escapeRe(q), $options: "i" } },
    { email: { $regex: escapeRe(q), $options: "i" } },
  ];
  // Phones are stored in different shapes over time (+91XXXXXXXXXX, 10 digits…): match the last digits.
  if (digits.length >= 4) or.push({ phone: { $regex: `${escapeRe(digits.slice(-10))}$` } });
  const rows = await M.find({ $or: or }).select("_id").limit(200).lean<{ _id: unknown }[]>();
  return rows.map((r) => String(r._id));
}

async function customersById(ids: string[]): Promise<Map<string, CustomerLite>> {
  const uniq = [...new Set(ids)].filter((i) => /^[a-f0-9]{24}$/i.test(i));
  if (!uniq.length) return new Map();
  const M = await customerModel();
  const rows = await M.find({ _id: { $in: uniq } }).select("name email phone").lean<{ _id: unknown; name?: string; email?: string; phone?: string }[]>();
  return new Map(rows.map((c) => [String(c._id), { id: String(c._id), name: c.name ?? "", email: c.email ?? "", phone: c.phone ?? "" }]));
}

/** Search text → filter. A Razorpay id is matched exactly; anything else is a customer search. */
async function resolveSearch(q?: string): Promise<{ none: true } | { customerIds?: string[]; gatewayId?: string }> {
  const s = (q ?? "").trim().slice(0, 80);
  if (!s) return {};
  if (/^(order|pay)_[A-Za-z0-9]{6,40}$/.test(s)) return { gatewayId: s };
  const ids = await findCustomerIds(s);
  return ids.length ? { customerIds: ids } : { none: true };
}

const iso = (d?: string) => (d && !Number.isNaN(Date.parse(d)) ? new Date(d).toISOString() : undefined);
/** "to" as a date means the whole day. */
const isoEnd = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T23:59:59.999+05:30`).toISOString() : iso(d));
const isoStart = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00.000+05:30`).toISOString() : iso(d));

export const walletAdminService = {
  async summary(): Promise<WalletStats> {
    // IST day boundaries for "today".
    const now = Date.now();
    const ist = new Date(now + 5.5 * 3600_000);
    const todayIst = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 5.5 * 3600_000).toISOString();
    return getWalletRepository().stats(
      { today: todayIst, week: new Date(now - 7 * 86400_000).toISOString(), month: new Date(now - 30 * 86400_000).toISOString() },
      new Date(now - 30 * 60_000).toISOString(),
    );
  },

  async recharges(f: { status?: string; q?: string; from?: string; to?: string; cursor?: string }): Promise<{ items: AdminRecharge[]; nextCursor: string | null }> {
    const s = await resolveSearch(f.q);
    if ("none" in s) return { items: [], nextCursor: null };
    const status = f.status === "paid" || f.status === "created" || f.status === "failed" ? f.status : undefined;
    const page = await getWalletRepository().allRecharges({ status, ...s, from: isoStart(f.from), to: isoEnd(f.to), cursor: f.cursor, limit: PAGE });
    const cust = await customersById(page.items.map((r) => r.customerId));
    return { items: page.items.map((r) => ({ ...r, customer: cust.get(r.customerId) ?? null })), nextCursor: page.nextCursor };
  },

  async txns(f: { type?: string; q?: string; from?: string; to?: string; cursor?: string }): Promise<{ items: AdminTxn[]; nextCursor: string | null }> {
    const empty = { items: [], nextCursor: null };
    const s = await resolveSearch(f.q);
    if ("none" in s) return empty;
    let customerIds = s.customerIds;
    if (s.gatewayId) {
      // A Razorpay id belongs to one recharge: show that customer's ledger.
      const r = (await getWalletRepository().allRecharges({ gatewayId: s.gatewayId, limit: 1 })).items[0];
      if (!r) return empty;
      customerIds = [r.customerId];
    }
    const types: WalletTxnType[] = ["recharge", "consultation", "refund", "adjustment", "reversal"];
    const type = types.find((t) => t === f.type);
    const page = await getWalletRepository().allTxns({ type, customerIds, from: isoStart(f.from), to: isoEnd(f.to), cursor: f.cursor, limit: PAGE });
    const cust = await customersById(page.items.map((t) => t.customerId));
    return { items: page.items.map((t) => ({ ...t, customer: cust.get(t.customerId) ?? null })), nextCursor: page.nextCursor };
  },

  /** Ask Razorpay about one recharge and settle it if it was paid (same exactly-once path as the app). */
  async reconcile(razorpayOrderId: string): Promise<Result<RechargeStatusView>> {
    const r = await getWalletRepository().rechargeByOrder(razorpayOrderId);
    if (!r) return fail(AppErrors.notFound("Recharge not found"));
    return walletService.rechargeStatus(r.customerId, razorpayOrderId, fetchOrderPayments);
  },
};

export type { WalletStats };
