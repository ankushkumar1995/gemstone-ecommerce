"use client";

/**
 * Admin: remedy sales. Every purchase made from a product / pooja an
 * astrologer suggested in a chat, its commission and stage. Cancels and
 * refunds reverse automatically; here the team can also reverse one by hand
 * (misuse, self-purchase, wrong attribution). A confirmed one is taken back
 * from the astrologer's earnings with a ledger row. Rules: Program settings.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, RotateCcw, Settings } from "lucide-react";
import { AdminButton, AdminTextarea, Badge, Card, Field, Modal, PageHeader, StatsSkeleton, Tabs, useAdminToast } from "@/app/admin/_components";
import { astroAdminApi, type RemedyRules, type RemedySale, type RemedyStats } from "@/lib/admin-astro-api";

type Tab = "all" | "waiting" | "in_window" | "confirmed" | "reversed";
const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "-");
const STAGE: Record<RemedySale["stage"], { tone: "green" | "gold" | "rose" | "blue"; label: string }> = {
  waiting: { tone: "blue", label: "Waiting for delivery / pooja" },
  in_window: { tone: "gold", label: "In return window" },
  confirmed: { tone: "green", label: "Paid to earnings" },
  reversed: { tone: "rose", label: "Reversed" },
};

export function RemedySalesAdminView() {
  const { toast } = useAdminToast();
  const [tab, setTab] = useState<Tab>("all");
  const [rows, setRows] = useState<RemedySale[] | null>(null);
  const [stats, setStats] = useState<RemedyStats | null>(null);
  const [rules, setRules] = useState<RemedyRules | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rev, setRev] = useState<RemedySale | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async (before?: string) => {
    setBusy(true);
    const r = await astroAdminApi.remedySales.list({ status: tab === "all" ? undefined : tab, before });
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    setStats(r.data.stats);
    setRules(r.data.rules);
    setNext(r.data.nextBefore);
    setRows((cur) => (before && cur ? [...cur, ...r.data.items] : r.data.items));
  }, [tab, toast]);

  useEffect(() => { const t = setTimeout(() => { setRows(null); void load(); }, 0); return () => clearTimeout(t); }, [load]);

  async function submit() {
    if (!rev) return;
    const r = await astroAdminApi.remedySales.reverse(rev.id, reason.trim());
    if (!r.ok) return toast(r.message, "error");
    toast(rev.status === "confirmed" ? "Reversed. The commission was taken back from earnings." : "Reversed. No commission will be paid.", "success");
    setRev(null); setReason("");
    void load();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Remedy sales" subtitle="Purchases from products and poojas astrologers suggested in chats, and the commission on each."
        action={<div className="flex gap-2">
          <Link href="/admin/astrologers/settings"><AdminButton variant="outline"><Settings size={15} /> Rules</AdminButton></Link>
          <AdminButton variant="outline" onClick={() => load()} loading={busy}><RefreshCw size={15} /> Refresh</AdminButton>
        </div>} />

      {rules && (
        <p className="text-sm" style={{ color: "var(--a-muted)" }}>
          {rules.enabled ? "On" : "Off"} · {rules.commissionPct}% commission · counts within {rules.attributionDays} days · final {rules.confirmAfterDays} days after delivery / pooja · {rules.maxPerChat} per chat{rules.maxCommissionPaise ? ` · up to ${inr(rules.maxCommissionPaise)} per sale` : ""}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat k="Suggestions sent" v={String(stats?.suggestions ?? 0)} />
        <Stat k="Sales" v={String(stats?.sales ?? 0)} />
        <Stat k="Pending commission" v={inr(stats?.pendingPaise ?? 0)} />
        <Stat k="Paid to earnings" v={inr(stats?.confirmedPaise ?? 0)} />
        <Stat k="Reversed" v={inr(stats?.reversedPaise ?? 0)} />
      </div>

      <Tabs<Tab> variant="pills" value={tab} onChange={setTab} tabs={[
        { value: "all", label: "All" }, { value: "waiting", label: "Waiting" }, { value: "in_window", label: "Return window" },
        { value: "confirmed", label: "Paid" }, { value: "reversed", label: "Reversed" },
      ]} />

      {!rows ? <StatsSkeleton count={3} /> : rows.length === 0 ? (
        <Card className="py-12 text-center"><p className="text-sm" style={{ color: "var(--a-muted)" }}>No remedy sales here yet.</p></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide" style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}>
                <th className="px-4 py-3">Item</th><th className="px-4 py-3">Astrologer → customer</th><th className="px-4 py-3">Bought</th>
                <th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Commission</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b align-top" style={{ borderColor: "var(--a-border)" }}>
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: "var(--a-fg)" }}>{s.itemName}{s.qty > 1 ? ` × ${s.qty}` : ""}</p>
                    <p className="text-xs" style={{ color: "var(--a-muted)" }}>
                      {s.source.kind === "order"
                        ? <Link href={`/admin/orders/${s.source.id}`} className="hover:underline">Order {s.source.number}</Link>
                        : <Link href={`/admin/poojas/bookings/${s.source.id}`} className="hover:underline">Booking {s.source.number}</Link>}
                      {" · chat "}{s.sessionNumber}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/astrologers/${s.astrologerId}`} className="font-medium hover:underline" style={{ color: "var(--a-fg)" }}>{s.astrologerName}</Link>
                    <span style={{ color: "var(--a-muted)" }}> → </span>
                    <Link href={`/admin/customers/${s.customerId}`} className="hover:underline">{s.customerName}</Link>
                  </td>
                  <td className="px-4 py-3 text-xs">{when(s.boughtAt)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{inr(s.basePaise)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{inr(s.commissionPaise)}<p className="text-xs font-normal" style={{ color: "var(--a-muted)" }}>{s.commissionPct}%</p></td>
                  <td className="px-4 py-3">
                    <Badge tone={STAGE[s.stage].tone}>{STAGE[s.stage].label}</Badge>
                    <p className="mt-1 text-xs" style={{ color: "var(--a-muted)" }}>
                      {s.stage === "in_window" ? `Final ${when(s.confirmAt)}` : s.stage === "confirmed" ? when(s.confirmedAt) : s.stage === "reversed" ? s.reason : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.status !== "reversed" && <AdminButton variant="ghost" onClick={() => { setReason(""); setRev(s); }}><RotateCcw size={14} /> Reverse</AdminButton>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {next && <div className="p-3 text-center"><AdminButton variant="outline" loading={busy} onClick={() => load(next)}>Load more</AdminButton></div>}
        </Card>
      )}

      <Modal open={!!rev} onClose={() => setRev(null)} title="Reverse this commission?" subtitle={rev ? `${rev.astrologerName} · ${rev.itemName} · ${inr(rev.commissionPaise)}` : undefined} size="sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--a-muted)" }}>
            {rev?.status === "confirmed" ? "It is already in the astrologer's earnings. It will be taken back now (a negative ledger row). This cannot be undone." : "No commission will be paid for this sale. This cannot be undone."} The astrologer is told the reason.
          </p>
          <Field label="Reason"><AdminTextarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} placeholder="For example: the astrologer bought it for themselves" /></Field>
          <div className="flex justify-end gap-2">
            <AdminButton variant="outline" onClick={() => setRev(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={submit} disabled={reason.trim().length < 5}>Reverse</AdminButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs" style={{ color: "var(--a-muted)" }}>{k}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: "var(--a-fg)" }}>{v}</p>
    </Card>
  );
}
