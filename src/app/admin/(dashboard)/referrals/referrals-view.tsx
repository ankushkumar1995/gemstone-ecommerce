"use client";

/**
 * Admin: refer-a-friend. Every friend who entered a code, its stage, and the
 * bonuses paid. Referrals that looked like misuse (several sign-ups from one
 * network for the same referrer) wait in "Held for review": approve pays both,
 * reject pays nothing. Paid bonuses are never taken back from here (use a
 * wallet adjustment if needed). Rules live in Program settings → Refer a friend.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, RefreshCw, Settings, X } from "lucide-react";
import { AdminButton, AdminTextarea, Badge, Card, Field, Modal, PageHeader, SearchInput, StatsSkeleton, Tabs, useAdminToast } from "@/app/admin/_components";
import { astroAdminApi, type AdminReferral } from "@/lib/admin-astro-api";

type Tab = "review" | "pending" | "rewarded" | "all";
const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "-");
const TONE: Record<AdminReferral["status"], "green" | "gold" | "muted" | "rose" | "blue"> = { pending: "gold", qualified: "blue", review: "rose", rewarded: "green", expired: "muted", rejected: "muted" };
const LABEL: Record<AdminReferral["status"], string> = { pending: "Waiting for recharge", qualified: "Paying", review: "Held for review", rewarded: "Paid", expired: "Expired", rejected: "Rejected" };
const FLAG: Record<string, string> = { same_network: "Several sign-ups from one network" };

export function ReferralsAdminView() {
  const { toast } = useAdminToast();
  const [tab, setTab] = useState<Tab>("review");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminReferral[] | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [decide, setDecide] = useState<{ r: AdminReferral; decision: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async (before?: string) => {
    setBusy(true);
    const r = await astroAdminApi.referrals.list({ status: tab === "all" ? undefined : tab, q: q.trim() || undefined, before });
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    setStats(r.data.stats);
    setNext(r.data.nextBefore);
    setRows((cur) => (before && cur ? [...cur, ...r.data.items] : r.data.items));
  }, [tab, q, toast]);

  useEffect(() => {
    const t = setTimeout(() => { setRows(null); void load(); }, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function submit() {
    if (!decide) return;
    const r = await astroAdminApi.referrals.decide(decide.r.id, decide.decision, note.trim());
    if (!r.ok) return toast(r.message, "error");
    toast(decide.decision === "approve" ? "Approved. Bonuses paid." : "Rejected. No bonus paid.", "success");
    setDecide(null); setNote("");
    void load();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Refer a friend" subtitle="Codes friends entered, bonuses paid, and referrals held for a check."
        action={<div className="flex gap-2">
          <Link href="/admin/astrologers/settings"><AdminButton variant="outline"><Settings size={15} /> Rules</AdminButton></Link>
          <AdminButton variant="outline" onClick={() => load()} loading={busy}><RefreshCw size={15} /> Refresh</AdminButton>
        </div>} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat k="Codes used" v={String(stats.total ?? 0)} />
        <Stat k="Waiting for recharge" v={String(stats.pending ?? 0)} />
        <Stat k="Held for review" v={String(stats.review ?? 0)} />
        <Stat k="Paid" v={String(stats.rewarded ?? 0)} />
        <Stat k="Bonus paid in total" v={inr(stats.paidPaise ?? 0)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs<Tab> variant="pills" value={tab} onChange={setTab} tabs={[
          { value: "review", label: "Held for review", count: stats.review },
          { value: "pending", label: "Waiting" },
          { value: "rewarded", label: "Paid" },
          { value: "all", label: "All" },
        ]} />
        <div className="min-w-[14rem] flex-1"><SearchInput value={q} onChange={setQ} placeholder="Search by code (AU…)" /></div>
      </div>

      {!rows ? <StatsSkeleton count={3} /> : rows.length === 0 ? (
        <Card className="py-12 text-center"><p className="text-sm" style={{ color: "var(--a-muted)" }}>{tab === "review" ? "Nothing to check." : "No referrals here."}</p></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide" style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}>
                <th className="px-4 py-3">Referrer → friend</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Entered</th>
                <th className="px-4 py-3">Recharge</th><th className="px-4 py-3">Bonus</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b align-top" style={{ borderColor: "var(--a-border)" }}>
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: "var(--a-fg)" }}>
                      <Link href={`/admin/customers/${r.referrerId}`} className="hover:underline">{r.referrerName || "Customer"}</Link> → <Link href={`/admin/customers/${r.refereeId}`} className="hover:underline">{r.refereeName || "Customer"}</Link>
                    </p>
                    {r.flags.map((f) => <p key={f} className="text-xs text-rose-600">{FLAG[f] ?? f}</p>)}
                    {r.reviewNote && <p className="text-xs" style={{ color: "var(--a-muted)" }}>{r.reviewedBy}: {r.reviewNote}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-3 text-xs">{when(r.appliedAt)}{r.status === "pending" && <><br /><span style={{ color: "var(--a-muted)" }}>until {when(r.expiresAt)}</span></>}</td>
                  <td className="px-4 py-3 tabular-nums">{r.rechargePaise ? inr(r.rechargePaise) : "-"}</td>
                  <td className="px-4 py-3 text-xs tabular-nums">
                    Friend {inr(r.refereeRewardPaise)}<br />Referrer {r.referrerCapped ? <span style={{ color: "var(--a-muted)" }}>none (monthly limit)</span> : inr(r.referrerRewardPaise)}
                  </td>
                  <td className="px-4 py-3"><Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>{r.rewardedAt && <p className="mt-1 text-xs" style={{ color: "var(--a-muted)" }}>{when(r.rewardedAt)}</p>}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {r.status === "review" && <AdminButton onClick={() => setDecide({ r, decision: "approve" })}><Check size={14} /> Approve</AdminButton>}
                      {(r.status === "review" || r.status === "pending") && <AdminButton variant="ghost" onClick={() => setDecide({ r, decision: "reject" })}><X size={14} /> Reject</AdminButton>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {next && <div className="p-3 text-center"><AdminButton variant="outline" loading={busy} onClick={() => load(next)}>Load more</AdminButton></div>}
        </Card>
      )}

      <Modal open={!!decide} onClose={() => setDecide(null)} title={decide?.decision === "approve" ? "Approve and pay bonuses?" : "Reject this referral?"}
        subtitle={decide ? `${decide.r.referrerName} → ${decide.r.refereeName} · ${decide.r.code}` : undefined} size="sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--a-muted)" }}>
            {decide?.decision === "approve"
              ? `The friend gets ${inr(decide.r.refereeRewardPaise)}${decide.r.referrerCapped ? "" : ` and the referrer gets ${inr(decide.r.referrerRewardPaise)}`} as wallet bonus, right away.`
              : "No bonus is paid to either of them. This cannot be undone."}
          </p>
          <Field label="Note (optional)"><AdminTextarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} /></Field>
          <div className="flex justify-end gap-2">
            <AdminButton variant="outline" onClick={() => setDecide(null)}>Cancel</AdminButton>
            <AdminButton variant={decide?.decision === "approve" ? "primary" : "danger"} onClick={submit}>{decide?.decision === "approve" ? "Approve and pay" : "Reject"}</AdminButton>
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
