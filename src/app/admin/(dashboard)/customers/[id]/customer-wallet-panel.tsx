"use client";

/**
 * Admin: a customer's wallet. Balance split, full ledger (filter + load more),
 * recent Razorpay recharges, and a manual credit/debit with a required reason.
 * Each adjustment carries a requestId made when the dialog opens, so a double
 * click or a network retry is applied only once. Server side it is audited.
 */

import { useState } from "react";
import { Wallet, Gift, IndianRupee, Plus, Loader2 } from "lucide-react";
import { astroAdminApi } from "@/lib/admin-astro-api";
import type { WalletRecharge, WalletTxn, WalletTxnType } from "@/modules/wallets/wallet.types";
import type { WalletView } from "@/modules/wallets/wallet.service";
import {
  Card, AdminButton, AdminInput, AdminSelect, AdminTextarea, Field, Modal, StatCard, StatusPill, Badge, Skeleton, useAdminToast, useOnMount,
} from "@/app/admin/_components";

const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const TYPES: (WalletTxnType | "all")[] = ["all", "recharge", "consultation", "refund", "adjustment", "reversal"];
const newRequestId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

export function CustomerWalletPanel({ customerId }: { customerId: string }) {
  const { toast } = useAdminToast();
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [recharges, setRecharges] = useState<WalletRecharge[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [type, setType] = useState<WalletTxnType | "all">("all");
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [adj, setAdj] = useState<null | { bucket: "cash" | "promo"; direction: "credit" | "debit"; amount: string; reason: string; requestId: string }>(null);

  const load = async () => {
    const r = await astroAdminApi.wallets.get(customerId);
    if (!r.ok) { setErrMsg(r.message); setState("error"); return; }
    setWallet(r.data.wallet); setTxns(r.data.txns); setCursor(r.data.nextCursor); setRecharges(r.data.recharges); setType("all"); setState("ok");
  };
  useOnMount(load);

  const filter = async (t: WalletTxnType | "all") => {
    setType(t); setBusy(true);
    const r = await astroAdminApi.wallets.txns(customerId, undefined, t === "all" ? undefined : t);
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    setTxns(r.data.items); setCursor(r.data.nextCursor);
  };
  const more = async () => {
    if (!cursor) return;
    setBusy(true);
    const r = await astroAdminApi.wallets.txns(customerId, cursor, type === "all" ? undefined : type);
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    setTxns((cur) => [...cur, ...r.data.items.filter((n) => !cur.some((o) => o.id === n.id))]); setCursor(r.data.nextCursor);
  };

  const amountNum = adj ? Number(adj.amount) : NaN;
  const amountOk = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= 100000 && /^\d+(\.\d{1,2})?$/.test(adj?.amount ?? "");
  const submit = async () => {
    if (!adj || !amountOk || adj.reason.trim().length < 5) return;
    setBusy(true);
    const r = await astroAdminApi.wallets.adjust(customerId, { bucket: adj.bucket, direction: adj.direction, amount: amountNum, reason: adj.reason.trim(), requestId: adj.requestId });
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    toast(`${adj.direction === "credit" ? "Credited" : "Debited"} ${inr(Math.round(amountNum * 100))}`, "success");
    setAdj(null);
    await load();
  };

  if (state === "loading") return <Card><Skeleton className="h-24 w-full" /></Card>;
  if (state === "error" || !wallet) {
    return (
      <Card>
        <h2 className="mb-2 font-semibold" style={{ color: "var(--a-fg)" }}>Wallet</h2>
        <p className="text-sm" style={{ color: "var(--a-muted)" }}>{errMsg || "Could not load the wallet."}</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Wallet</h2>
        <AdminButton variant="outline" onClick={() => setAdj({ bucket: "promo", direction: "credit", amount: "", reason: "", requestId: newRequestId() })}>
          <Plus size={15} /> Adjust balance
        </AdminButton>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Wallet} value={inr(wallet.totalPaise)} label="Total" tone="gold" />
        <StatCard icon={IndianRupee} value={inr(wallet.cashPaise)} label="Paid (refundable)" tone="green" />
        <StatCard icon={Gift} value={inr(wallet.promoPaise)} label="Bonus" tone="royal" />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {TYPES.map((t) => (
          <button key={t} type="button" aria-pressed={type === t} onClick={() => filter(t)} className="rounded-full px-3 py-1 text-xs font-medium capitalize"
            style={{ background: type === t ? "var(--a-gold-soft, rgba(201,148,42,.15))" : "rgba(0,0,0,.04)", color: type === t ? "var(--a-gold)" : "var(--a-muted)" }}>
            {t}
          </button>
        ))}
        {busy && <Loader2 size={14} className="animate-spin" style={{ color: "var(--a-muted)" }} />}
      </div>

      {txns.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: "var(--a-faint)" }}>No transactions.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: "var(--a-muted)" }}>
                <th className="py-2 pr-3 font-medium">When</th>
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
                <tr key={t.id} className="border-t" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
                  <td className="whitespace-nowrap py-2 pr-3 text-xs">{new Date(t.at).toLocaleString("en-IN")}</td>
                  <td className="py-2 pr-3"><Badge tone={t.type === "recharge" ? "green" : t.type === "consultation" ? "royal" : t.type === "refund" ? "blue" : "gold"}>{t.type}</Badge></td>
                  <td className="max-w-[16rem] py-2 pr-3" title={`${t.note}${t.ref ? ` · ref ${t.ref}` : ""} · key ${t.key}`}><span className="line-clamp-2">{t.note}</span></td>
                  <td className="py-2 pr-3 text-right tabular-nums" style={{ color: t.cashPaise < 0 ? "#be123c" : t.cashPaise > 0 ? "#047857" : "var(--a-faint)" }}>{t.cashPaise ? `${t.cashPaise > 0 ? "+" : "−"}${inr(Math.abs(t.cashPaise))}` : "·"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums" style={{ color: t.promoPaise < 0 ? "#be123c" : t.promoPaise > 0 ? "#047857" : "var(--a-faint)" }}>{t.promoPaise ? `${t.promoPaise > 0 ? "+" : "−"}${inr(Math.abs(t.promoPaise))}` : "·"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{inr(t.cashAfter + t.promoAfter)}</td>
                  <td className="py-2 text-xs" style={{ color: "var(--a-muted)" }}>{t.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor && <div className="mt-3 text-center"><AdminButton variant="ghost" disabled={busy} onClick={more}>Load more</AdminButton></div>}

      {recharges.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Recent recharges</h3>
          <ul className="space-y-1.5 text-sm">
            {recharges.slice(0, 10).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2" style={{ color: "var(--a-muted)" }}>
                <span>{new Date(r.createdAt).toLocaleString("en-IN")} · {inr(r.amountPaise)}{r.bonusPaise ? ` + ${inr(r.bonusPaise)} bonus` : ""}{r.gstPaise ? ` (+${inr(r.gstPaise)} GST)` : ""}</span>
                <span className="flex items-center gap-2">
                  {r.razorpayPaymentId && <code className="text-xs">{r.razorpayPaymentId}</code>}
                  <StatusPill tone={r.status === "paid" ? "green" : r.status === "failed" ? "rose" : "gold"}>{r.status}</StatusPill>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={!!adj} onClose={() => !busy && setAdj(null)} title="Adjust wallet balance" subtitle="Recorded in the ledger and the audit log with your name." size="sm">
        {adj && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Action">
                <AdminSelect value={adj.direction} onChange={(e) => setAdj({ ...adj, direction: e.target.value as "credit" | "debit" })}>
                  <option value="credit">Credit (add)</option>
                  <option value="debit">Debit (remove)</option>
                </AdminSelect>
              </Field>
              <Field label="Bucket" hint={adj.bucket === "cash" ? "Refundable money" : "Goodwill / promo"}>
                <AdminSelect value={adj.bucket} onChange={(e) => setAdj({ ...adj, bucket: e.target.value as "cash" | "promo" })}>
                  <option value="promo">Bonus</option>
                  <option value="cash">Paid</option>
                </AdminSelect>
              </Field>
            </div>
            <Field label="Amount (₹)" hint={`Current ${adj.bucket === "cash" ? "paid" : "bonus"} balance: ${inr(adj.bucket === "cash" ? wallet.cashPaise : wallet.promoPaise)}`}>
              <AdminInput inputMode="decimal" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value.replace(/[^\d.]/g, "").slice(0, 9) })} placeholder="0.00" />
            </Field>
            <Field label="Reason (required)">
              <AdminTextarea rows={3} value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value.slice(0, 250) })} placeholder="e.g. Goodwill credit for a dropped chat, ticket #1234" />
            </Field>
            <AdminButton className="w-full" variant={adj.direction === "debit" ? "danger" : "primary"} disabled={busy || !amountOk || adj.reason.trim().length < 5} onClick={submit}>
              {busy && <Loader2 size={15} className="animate-spin" />}
              {adj.direction === "credit" ? "Credit" : "Debit"} {amountOk ? inr(Math.round(amountNum * 100)) : ""}
            </AdminButton>
          </div>
        )}
      </Modal>
    </Card>
  );
}
