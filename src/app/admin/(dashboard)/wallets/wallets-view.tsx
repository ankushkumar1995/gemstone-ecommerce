"use client";

/**
 * Admin → Finance → Wallets. Every customer's wallet activity in one place.
 *
 *  • Summary: paid recharges today / 7 / 30 days, money customers hold
 *    (paid + bonus), and recharges started but never paid.
 *  • Recharges: each top-up with customer, amounts, GST, status and Razorpay
 *    ids; "Check with Razorpay" settles one that was paid but not confirmed.
 *  • Transactions: the ledger across all customers.
 *  • Search by name, phone, email, or a Razorpay order / payment id.
 *  • CSV export of what is loaded.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Download, Gift, IndianRupee, Loader2, RefreshCw, Users, Wallet } from "lucide-react";
import { astroAdminApi } from "@/lib/admin-astro-api";
import type { AdminRecharge, AdminTxn, WalletStats } from "@/modules/wallets/wallet.admin";
import {
  AdminButton, Badge, Card, CopyButton, DateRange, EmptyState, PageHeader, SearchInput, Skeleton, StatCard, StatusPill, Tabs, useAdminToast,
} from "../../_components";

const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const OLD_MS = 30 * 60_000;

type Tab = "recharges" | "transactions";
type RechargeFilter = "all" | "paid" | "created" | "failed";
const TXN_TYPES = ["all", "recharge", "consultation", "refund", "adjustment", "reversal"] as const;

/** DateRange preset → from date (YYYY-MM-DD, IST). */
function fromOf(range: string): string | undefined {
  if (range === "all") return undefined;
  const days = range === "today" ? 0 : range === "7d" ? 6 : 29;
  const d = new Date(Date.now() + 5.5 * 3600_000 - days * 86400_000);
  return d.toISOString().slice(0, 10);
}

function useDebounced<T>(v: T, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

function csv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => { const s = String(c ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
}
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Who({ c, id }: { c: AdminRecharge["customer"]; id: string }) {
  if (!c) return <span className="text-xs" style={{ color: "var(--a-faint)" }}>Deleted customer ({id.slice(-6)})</span>;
  return (
    <Link href={`/admin/customers/${c.id}`} className="block min-w-0 hover:underline">
      <span className="block truncate font-medium" style={{ color: "var(--a-fg)" }}>{c.name || "No name yet"}</span>
      <span className="block truncate text-xs" style={{ color: "var(--a-faint)" }}>{[c.phone, c.email].filter(Boolean).join(" · ") || "–"}</span>
    </Link>
  );
}

function rechargeTone(r: AdminRecharge): { tone: "green" | "gold" | "rose" | "muted"; label: string } {
  if (r.status === "paid") return { tone: "green", label: "Paid" };
  if (r.status === "failed") return { tone: "rose", label: "Failed" };
  return Date.now() - Date.parse(r.createdAt) > OLD_MS ? { tone: "muted", label: "Not paid" } : { tone: "gold", label: "In progress" };
}

export function WalletsView() {
  const { toast } = useAdminToast();
  const [tab, setTab] = useState<Tab>("recharges");
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [range, setRange] = useState("30d");
  const [rFilter, setRFilter] = useState<RechargeFilter>("all");
  const [tType, setTType] = useState<(typeof TXN_TYPES)[number]>("all");

  const [stats, setStats] = useState<WalletStats | null>(null);
  const [recharges, setRecharges] = useState<AdminRecharge[]>([]);
  const [txns, setTxns] = useState<AdminTxn[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState<string | null>(null);
  const reqId = useRef(0);

  const loadStats = useCallback(async () => {
    const r = await astroAdminApi.wallets.summary();
    if (r.ok) setStats(r.data);
  }, []);

  const load = useCallback(async (append = false, after?: string | null) => {
    const id = ++reqId.current;
    if (append) setMore(true); else { setLoading(true); setError(""); }
    const from = fromOf(range);
    const res = tab === "recharges"
      ? await astroAdminApi.wallets.allRecharges({ status: rFilter === "all" ? undefined : rFilter, q: dq || undefined, from, cursor: after ?? undefined })
      : await astroAdminApi.wallets.allTxns({ type: tType === "all" ? undefined : tType, q: dq || undefined, from, cursor: after ?? undefined });
    if (id !== reqId.current) return; // a newer filter won
    setLoading(false); setMore(false);
    if (!res.ok) { if (append) toast(res.message, "error"); else setError(res.message); return; }
    if (tab === "recharges") {
      const items = res.data.items as AdminRecharge[];
      setRecharges((cur) => (append ? [...cur, ...items.filter((n) => !cur.some((o) => o.id === n.id))] : items));
    } else {
      const items = res.data.items as AdminTxn[];
      setTxns((cur) => (append ? [...cur, ...items.filter((n) => !cur.some((o) => o.id === n.id))] : items));
    }
    setCursor(res.data.nextCursor);
  }, [tab, rFilter, tType, dq, range, toast]);

  // Load on mount and whenever a filter changes (scheduled, so state is set from a callback).
  useEffect(() => { const t = setTimeout(() => void loadStats(), 0); return () => clearTimeout(t); }, [loadStats]);
  useEffect(() => { const t = setTimeout(() => void load(false, null), 0); return () => clearTimeout(t); }, [load]);

  const refresh = () => { void loadStats(); void load(false, null); };

  const check = async (r: AdminRecharge) => {
    if (!r.razorpayOrderId) return;
    setChecking(r.id);
    const res = await astroAdminApi.wallets.reconcile(r.razorpayOrderId);
    setChecking(null);
    if (!res.ok) return toast(res.message, "error");
    const s = res.data;
    const msg = s.state === "paid" ? (s.justCredited ? `Paid. Wallet credited ${inr(s.creditedPaise)} now.` : "Already paid and credited.")
      : s.state === "processing" ? "Bank approved, Razorpay is still capturing. Check again in a minute."
      : s.state === "failed" ? `Payment failed: ${s.reason ?? "declined"}`
      : s.state === "review" ? "Amount paid does not match. Not credited. Check this one in Razorpay."
      : "No completed payment on Razorpay for this recharge.";
    toast(msg, s.state === "paid" ? "success" : s.state === "review" || s.state === "failed" ? "error" : "info");
    refresh();
  };

  const exportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (tab === "recharges") {
      download(`wallet-recharges-${stamp}.csv`, csv([
        ["Created", "Paid at", "Customer", "Phone", "Email", "Recharge (₹)", "Bonus (₹)", "GST (₹)", "Paid by customer (₹)", "Status", "Razorpay order", "Razorpay payment", "Recharge id"],
        ...recharges.map((r) => [r.createdAt, r.paidAt ?? "", r.customer?.name ?? "", r.customer?.phone ?? "", r.customer?.email ?? "", r.amountPaise / 100, r.bonusPaise / 100, r.gstPaise / 100, r.payablePaise / 100, r.status, r.razorpayOrderId ?? "", r.razorpayPaymentId ?? "", r.id]),
      ]));
    } else {
      download(`wallet-transactions-${stamp}.csv`, csv([
        ["At", "Customer", "Phone", "Type", "Note", "Paid (₹)", "Bonus (₹)", "Balance after (₹)", "By", "Ref"],
        ...txns.map((t) => [t.at, t.customer?.name ?? "", t.customer?.phone ?? "", t.type, t.note, t.cashPaise / 100, t.promoPaise / 100, (t.cashAfter + t.promoAfter) / 100, t.actor, t.ref ?? ""]),
      ]));
    }
  };

  const rows = tab === "recharges" ? recharges.length : txns.length;

  return (
    <div>
      <PageHeader
        title="Wallets"
        subtitle="Customer wallet recharges and every wallet transaction, from the app and the website."
        action={
          <div className="flex gap-2">
            <AdminButton variant="outline" onClick={refresh}><RefreshCw size={15} /> Refresh</AdminButton>
            <AdminButton variant="outline" onClick={exportCsv} disabled={!rows}><Download size={15} /> Export CSV</AdminButton>
          </div>
        }
      />

      {stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={IndianRupee} tone="green" value={inr(stats.paid.today?.payablePaise ?? 0)} label={`Collected today · ${stats.paid.today?.count ?? 0} recharges`} />
          <StatCard icon={IndianRupee} tone="gold" value={inr(stats.paid.month?.payablePaise ?? 0)} label={`Last 30 days · ${stats.paid.month?.count ?? 0} recharges · ${inr(stats.paid.month?.gstPaise ?? 0)} GST`} />
          <StatCard icon={Wallet} tone="royal" value={inr(stats.held.cashPaise + stats.held.promoPaise)} label={`Held in ${stats.held.wallets} wallets · ${inr(stats.held.cashPaise)} paid + ${inr(stats.held.promoPaise)} bonus`} />
          <StatCard icon={Gift} tone="blue" value={inr(stats.paid.month?.bonusPaise ?? 0)} label="Bonus given · last 30 days" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      )}

      {stats && stats.unpaidOld > 0 ? (
        <button type="button" onClick={() => { setTab("recharges"); setRFilter("created"); }} className="mt-4 flex w-full items-start gap-2 rounded-lg border px-4 py-3 text-left text-sm" style={{ borderColor: "rgba(230,180,58,.45)", background: "rgba(230,180,58,.08)", color: "var(--a-fg)" }}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <span><b>{stats.unpaidOld}</b> recharge{stats.unpaidOld > 1 ? "s were" : " was"} started more than 30 minutes ago and never confirmed. Most were simply abandoned; use &quot;Check with Razorpay&quot; on any that a customer says they paid. <u>Show them</u></span>
        </button>
      ) : null}

      <Card className="mt-6 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Tabs<Tab> tabs={[{ value: "recharges", label: "Recharges" }, { value: "transactions", label: "All transactions" }]} value={tab} onChange={(v) => { setTab(v); setCursor(null); }} />
          <DateRange value={range} onChange={setRange} />
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchInput value={q} onChange={setQ} placeholder="Name, phone, email, order_… or pay_…" className="min-w-[16rem] flex-1" />
          <div className="flex flex-wrap gap-1.5">
            {(tab === "recharges" ? (["all", "paid", "created", "failed"] as const) : TXN_TYPES).map((v) => {
              const on = tab === "recharges" ? rFilter === v : tType === v;
              const label = v === "created" ? "Not paid" : v;
              return (
                <button key={v} type="button" aria-pressed={on} onClick={() => (tab === "recharges" ? setRFilter(v as RechargeFilter) : setTType(v as (typeof TXN_TYPES)[number]))}
                  className="rounded-full px-3 py-1 text-xs font-medium capitalize" style={{ background: on ? "var(--a-gold-soft, rgba(201,148,42,.15))" : "rgba(0,0,0,.04)", color: on ? "var(--a-gold)" : "var(--a-muted)" }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : error ? (
          <EmptyState title="Could not load" message={error} />
        ) : rows === 0 ? (
          <EmptyState title="Nothing here" message={dq ? "No wallet activity matches this search." : "No wallet activity in this period."} />
        ) : tab === "recharges" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: "var(--a-muted)" }}>
                  <th className="py-2 pr-3 font-medium">Created</th>
                  <th className="py-2 pr-3 font-medium">Customer</th>
                  <th className="py-2 pr-3 text-right font-medium">Recharge</th>
                  <th className="py-2 pr-3 text-right font-medium">Bonus</th>
                  <th className="py-2 pr-3 text-right font-medium">GST</th>
                  <th className="py-2 pr-3 text-right font-medium">Customer paid</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Razorpay</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {recharges.map((r) => {
                  const st = rechargeTone(r);
                  return (
                    <tr key={r.id} className="border-t align-top" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-xs">{when(r.createdAt)}{r.paidAt ? <span className="block" style={{ color: "var(--a-faint)" }}>paid {when(r.paidAt)}</span> : null}</td>
                      <td className="max-w-[14rem] py-2.5 pr-3"><Who c={r.customer} id={r.customerId} /></td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{inr(r.amountPaise)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums" style={{ color: r.bonusPaise ? "#047857" : "var(--a-faint)" }}>{r.bonusPaise ? `+${inr(r.bonusPaise)}` : "·"}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums" style={{ color: r.gstPaise ? "var(--a-fg)" : "var(--a-faint)" }}>{r.gstPaise ? inr(r.gstPaise) : "·"}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{inr(r.payablePaise)}</td>
                      <td className="py-2.5 pr-3"><StatusPill tone={st.tone}>{st.label}</StatusPill></td>
                      <td className="py-2.5 pr-3 text-xs">
                        {r.razorpayOrderId ? <span className="flex items-center gap-1"><code>{r.razorpayOrderId}</code><CopyButton value={r.razorpayOrderId} /></span> : <span style={{ color: "var(--a-faint)" }}>No order</span>}
                        {r.razorpayPaymentId ? <span className="mt-0.5 flex items-center gap-1"><code>{r.razorpayPaymentId}</code><CopyButton value={r.razorpayPaymentId} /></span> : null}
                      </td>
                      <td className="py-2.5 text-right">
                        {r.status !== "paid" && r.razorpayOrderId ? (
                          <AdminButton variant="ghost" disabled={checking === r.id} onClick={() => check(r)}>
                            {checking === r.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Check with Razorpay
                          </AdminButton>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: "var(--a-muted)" }}>
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Customer</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Note</th>
                  <th className="py-2 pr-3 text-right font-medium">Paid</th>
                  <th className="py-2 pr-3 text-right font-medium">Bonus</th>
                  <th className="py-2 pr-3 text-right font-medium">Balance after</th>
                  <th className="py-2 font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="border-t align-top" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-xs">{when(t.at)}</td>
                    <td className="max-w-[14rem] py-2.5 pr-3"><Who c={t.customer} id={t.customerId} /></td>
                    <td className="py-2.5 pr-3"><Badge tone={t.type === "recharge" ? "green" : t.type === "consultation" ? "royal" : t.type === "refund" ? "blue" : "gold"}>{t.type}</Badge></td>
                    <td className="max-w-[18rem] py-2.5 pr-3" title={`${t.note}${t.ref ? ` · ref ${t.ref}` : ""}`}><span className="line-clamp-2">{t.note}</span></td>
                    <td className="py-2.5 pr-3 text-right tabular-nums" style={{ color: t.cashPaise < 0 ? "#be123c" : t.cashPaise > 0 ? "#047857" : "var(--a-faint)" }}>{t.cashPaise ? `${t.cashPaise > 0 ? "+" : "−"}${inr(Math.abs(t.cashPaise))}` : "·"}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums" style={{ color: t.promoPaise < 0 ? "#be123c" : t.promoPaise > 0 ? "#047857" : "var(--a-faint)" }}>{t.promoPaise ? `${t.promoPaise > 0 ? "+" : "−"}${inr(Math.abs(t.promoPaise))}` : "·"}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{inr(t.cashAfter + t.promoAfter)}</td>
                    <td className="py-2.5 text-xs" style={{ color: "var(--a-muted)" }}>{t.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && cursor ? (
          <div className="mt-4 text-center">
            <AdminButton variant="ghost" disabled={more} onClick={() => load(true, cursor)}>{more ? <Loader2 size={14} className="animate-spin" /> : null} Load more</AdminButton>
          </div>
        ) : null}
        {!loading && rows > 0 ? <p className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: "var(--a-faint)" }}><Users size={12} /> Showing {rows}{cursor ? "+" : ""} · CSV exports what is loaded.</p> : null}
      </Card>
    </div>
  );
}
