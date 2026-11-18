"use client";

/**
 * Admin: astrologer payouts and earnings.
 *
 * Payouts tab: the work queue. Approve or reject requests, pay by bank transfer
 * and enter the UTR (manual), or send through RazorpayX (when it is the
 * provider). Export approved payouts as a CSV for a bank bulk upload.
 * Balances tab: every partner's withdrawable / on hold / paid, their ledger,
 * and manual adjustments (+ or −, with a reason).
 * Everything here is audited, and money only moves through the ledger.
 */

import { useCallback, useEffect, useState } from "react";
import { Copy, Download, PlayCircle, RefreshCw, Wrench } from "lucide-react";
import { AdminButton, AdminInput, AdminTextarea, Badge, Card, ConfirmDialog, Drawer, Field, PageHeader, StatsSkeleton, Tabs, useAdminToast } from "@/app/admin/_components";
import { astroAdminApi } from "@/lib/admin-astro-api";
import type { EarningsBalance, LedgerEntry, Payout } from "@/modules/earnings/earnings.types";

type Tab = "open" | "paid" | "failed" | "all" | "balances";
const inr = (paise: number) => `${paise < 0 ? "−" : ""}₹${(Math.abs(paise) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "-");
const reqId = () => { try { return crypto.randomUUID().replace(/-/g, ""); } catch { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; } };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TONE: Record<Payout["status"], "green" | "gold" | "muted" | "rose" | "blue" | "royal"> = { requested: "gold", approved: "blue", processing: "royal", paid: "green", failed: "rose", rejected: "rose", cancelled: "muted" };

type Provider = { mode: "manual" | "razorpayx"; razorpayxReady: boolean; autoCreate: boolean; cycleWeekday: number };
type Detail = Awaited<ReturnType<typeof astroAdminApi.payouts.get>> extends { ok: true; data: infer D } | { ok: false } ? D : never;

export function PayoutsAdminView() {
  const { toast } = useAdminToast();
  const [tab, setTab] = useState<Tab>("open");
  const [rows, setRows] = useState<Payout[] | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [balances, setBalances] = useState<{ astrologerId: string; name: string; balance: EarningsBalance }[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [astroId, setAstroId] = useState<string | null>(null);
  const [confirmRun, setConfirmRun] = useState(false);

  const load = useCallback(async (t: Tab) => {
    if (t === "balances") {
      const r = await astroAdminApi.earnings.balances();
      if (r.ok) setBalances(r.data.balances); else toast(r.message, "error");
      return;
    }
    const status = t === "failed" ? "failed" : t === "paid" ? "paid" : t === "all" ? "all" : "open";
    const r = await astroAdminApi.payouts.list(status);
    if (r.ok) { setRows(r.data.payouts); setProvider(r.data.provider); } else toast(r.message, "error");
  }, [toast]);

  useEffect(() => {
    const t = setTimeout(() => { setRows(null); setBalances(null); void load(tab); }, 0);
    return () => clearTimeout(t);
  }, [tab, load]);

  async function reconcile() {
    const r = await astroAdminApi.earnings.reconcile();
    if (!r.ok) return toast(r.message, "error");
    const n = r.data.consultations + r.data.refunds + r.data.gifts + r.data.tips;
    toast(n ? `Added ${r.data.consultations} chats, ${r.data.refunds} refunds, ${r.data.gifts} gifts, ${r.data.tips} tips to the ledger.` : "The ledger is complete. Nothing was missing.", "success");
    void load(tab);
  }
  async function runWeekly() {
    setConfirmRun(false);
    const r = await astroAdminApi.earnings.runWeekly();
    if (!r.ok) return toast(r.message, "error");
    toast(r.data.ran ? `Payout cycle ran: ${r.data.created} payouts created, ${r.data.skipped} skipped.` : `The payout cycle already ran today (${r.data.date}).`, "info");
    void load(tab);
  }

  const open = rows?.filter((p) => p.status === "requested" || p.status === "approved" || p.status === "processing") ?? [];
  const toPay = open.filter((p) => p.status !== "processing").reduce((n, p) => n + p.netPaise, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Astrologer payouts" subtitle="Approve, pay and track partner payouts. Money moves only through the earnings ledger."
        action={
          <div className="flex flex-wrap gap-2">
            <AdminButton variant="outline" onClick={reconcile}><Wrench size={15} /> Reconcile ledger</AdminButton>
            <AdminButton variant="outline" onClick={() => setConfirmRun(true)}><PlayCircle size={15} /> Run payout cycle</AdminButton>
            <a href={astroAdminApi.payouts.exportUrl("approved")}><AdminButton variant="outline"><Download size={15} /> Approved as CSV</AdminButton></a>
          </div>
        } />

      {provider && (
        <Card className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <Badge tone={provider.mode === "razorpayx" ? "royal" : "muted"}>{provider.mode === "razorpayx" ? "RazorpayX (automatic)" : "Manual bank transfer"}</Badge>
          {provider.mode === "razorpayx" && !provider.razorpayxReady && <Badge tone="rose">RazorpayX keys missing on the server</Badge>}
          <span style={{ color: "var(--a-muted)" }}>{provider.autoCreate ? `Payouts are created every ${DAYS[provider.cycleWeekday]} for everyone above the minimum.` : "Partners request payouts themselves."} Change in Astrologers → Program settings.</span>
          {tab === "open" && open.length > 0 && <span className="ml-auto font-semibold" style={{ color: "var(--a-fg)" }}>{open.length} open · {inr(toPay)} to pay</span>}
        </Card>
      )}

      <Tabs<Tab> variant="pills" value={tab} onChange={setTab} tabs={[
        { value: "open", label: "To do", count: tab === "open" ? open.length : undefined },
        { value: "paid", label: "Paid" },
        { value: "failed", label: "Failed" },
        { value: "all", label: "All" },
        { value: "balances", label: "Partner balances" },
      ]} />

      {tab === "balances" ? (
        !balances ? <StatsSkeleton count={3} /> : balances.length === 0 ? <Card className="py-12 text-center"><p className="text-sm" style={{ color: "var(--a-muted)" }}>No earnings yet.</p></Card> : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b text-left text-xs uppercase tracking-wide" style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}>
                <th className="px-4 py-3">Partner</th><th className="px-4 py-3 text-right">Withdrawable</th><th className="px-4 py-3 text-right">On hold</th><th className="px-4 py-3 text-right">In payout</th><th className="px-4 py-3 text-right">Earned</th><th className="px-4 py-3 text-right">Paid out</th>
              </tr></thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.astrologerId} onClick={() => setAstroId(b.astrologerId)} className="cursor-pointer border-b hover:bg-black/[0.03]" style={{ borderColor: "var(--a-border)" }}>
                    <td className="px-4 py-3 font-medium">{b.name}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ color: b.balance.availablePaise < 0 ? "#be123c" : undefined }}>{inr(b.balance.availablePaise)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{inr(b.balance.onHoldPaise)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{inr(b.balance.inPayoutPaise)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{inr(b.balance.lifetimePaise)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{inr(b.balance.paidOutPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      ) : !rows ? <StatsSkeleton count={3} /> : rows.length === 0 ? (
        <Card className="py-12 text-center"><p className="text-sm" style={{ color: "var(--a-muted)" }}>{tab === "open" ? "Nothing to pay right now." : "Nothing here."}</p></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="border-b text-left text-xs uppercase tracking-wide" style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}>
              <th className="px-4 py-3">Payout</th><th className="px-4 py-3">Partner</th><th className="px-4 py-3">To</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">TDS</th><th className="px-4 py-3 text-right">To pay</th><th className="px-4 py-3">Status</th>
            </tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} onClick={() => setOpenId(p.id)} className="cursor-pointer border-b hover:bg-black/[0.03]" style={{ borderColor: "var(--a-border)" }}>
                  <td className="px-4 py-3"><p className="font-medium">{p.payoutNumber}</p><p className="text-xs" style={{ color: "var(--a-muted)" }}>{when(p.createdAt)}{p.requestedBy === "auto" ? " · weekly cycle" : ""}</p></td>
                  <td className="px-4 py-3">{p.astrologer.name}</td>
                  <td className="px-4 py-3 text-xs">{p.destination.method === "bank" ? `${p.destination.bankName ?? "Bank"} ${p.destination.accountNumberMasked ?? ""}` : p.destination.upiId}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{inr(p.amountPaise)}</td>
                  <td className="px-4 py-3 text-right tabular-nums" style={{ color: "var(--a-muted)" }}>{p.tdsPaise ? inr(p.tdsPaise) : "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{inr(p.netPaise)}</td>
                  <td className="px-4 py-3"><Badge tone={TONE[p.status]}>{p.status}</Badge>{p.utr && <p className="text-[11px]" style={{ color: "var(--a-muted)" }}>UTR {p.utr}</p>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {openId && <PayoutDrawer id={openId} provider={provider} onClose={() => setOpenId(null)} onChanged={() => void load(tab)} />}
      {astroId && <BalanceDrawer astrologerId={astroId} name={balances?.find((b) => b.astrologerId === astroId)?.name ?? "Partner"} onClose={() => setAstroId(null)} onChanged={() => void load(tab)} />}

      <ConfirmDialog open={confirmRun} onClose={() => setConfirmRun(false)} onConfirm={() => void runWeekly()} confirmLabel="Run now" title="Run the payout cycle now?"
        message="A payout request is created for every partner with a withdrawable balance above the minimum and a payout account. It runs once per day." />
    </div>
  );
}

/* ---------------- one payout ---------------- */

function PayoutDrawer({ id, provider, onClose, onChanged }: { id: string; provider: Provider | null; onClose: () => void; onChanged: () => void }) {
  const { toast } = useAdminToast();
  const [d, setD] = useState<Detail | null>(null);
  const [utr, setUtr] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<null | "reject" | "mark_failed" | "send">(null);

  const load = useCallback(async () => {
    const r = await astroAdminApi.payouts.get(id);
    if (r.ok) setD(r.data); else { toast(r.message, "error"); onClose(); }
  }, [id, toast, onClose]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  async function act(action: Parameters<typeof astroAdminApi.payouts.act>[1], extra: { utr?: string; reason?: string } = {}, msg?: string) {
    const r = await astroAdminApi.payouts.act(id, action, extra);
    if (!r.ok) { toast(r.message, "error"); return; }
    if (msg) toast(msg, "success");
    setUtr(""); setReason("");
    await load();
    onChanged();
  }
  const copy = (v?: string) => { if (v) void navigator.clipboard.writeText(v).then(() => toast("Copied", "info")); };

  const p = d?.payout;
  const dest = d?.destination;
  const auto = provider?.mode === "razorpayx";
  return (
    <Drawer open onClose={onClose} title={p ? `Payout ${p.payoutNumber}` : "Payout"} subtitle={p ? `${p.astrologer.name} · ${when(p.createdAt)}` : undefined}>
      {!d || !p ? <StatsSkeleton count={3} /> : (
        <div className="space-y-5 text-sm">
          <div className="grid grid-cols-3 gap-2">
            <Info k="Amount" v={inr(p.amountPaise)} />
            <Info k={`TDS ${p.tdsRatePct ? `${p.tdsRatePct}%` : ""}`} v={p.tdsPaise ? inr(p.tdsPaise) : "-"} />
            <Info k="To pay" v={<b>{inr(p.netPaise)}</b>} />
          </div>
          <div className="flex items-center gap-2"><Badge tone={TONE[p.status]}>{p.status}</Badge>{p.utr && <span>UTR <b>{p.utr}</b></span>}{p.failureReason && <span className="text-rose-700">{p.failureReason}</span>}</div>

          <div className="rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-muted)" }}>Pay to {dest?.verified ? <Badge tone="green">verified</Badge> : <Badge tone="rose">not verified</Badge>}</p>
            {!dest ? <p className="text-rose-700">No payout account on file.</p> : dest.method === "bank" ? (
              <div className="space-y-1">
                <CopyRow k="Name" v={dest.accountHolder} onCopy={copy} />
                <CopyRow k="Account" v={dest.accountNumber} onCopy={copy} />
                <CopyRow k="IFSC" v={dest.ifsc} onCopy={copy} />
                <CopyRow k="Bank" v={dest.bankName} onCopy={copy} />
              </div>
            ) : (
              <div className="space-y-1"><CopyRow k="Name" v={dest.accountHolder} onCopy={copy} /><CopyRow k="UPI" v={dest.upiId} onCopy={copy} /></div>
            )}
            {p.pan && <p className="mt-2 text-xs" style={{ color: "var(--a-muted)" }}>PAN {p.pan}</p>}
          </div>

          <p className="text-xs" style={{ color: "var(--a-muted)" }}>Partner balance now: {inr(d.balance.availablePaise)} withdrawable, {inr(d.balance.onHoldPaise)} on hold.</p>

          {/* actions */}
          {p.status === "requested" && (
            <div className="flex flex-wrap gap-2">
              <AdminButton onClick={() => act("approve", {}, "Approved")}>Approve</AdminButton>
              <AdminButton variant="outline" onClick={() => setConfirm("reject")}>Reject</AdminButton>
            </div>
          )}
          {(p.status === "approved" || p.status === "requested" || (p.status === "processing" && !auto)) && (
            <div className="space-y-2 rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
              <p className="font-semibold">Paid by bank transfer?</p>
              <Field label="Bank reference (UTR)"><AdminInput value={utr} onChange={(e) => setUtr(e.target.value.toUpperCase())} placeholder="e.g. HDFCN26111712345" maxLength={30} /></Field>
              <AdminButton onClick={() => act("mark_paid", { utr }, "Marked paid")} disabled={utr.trim().length < 6}>Mark paid</AdminButton>
            </div>
          )}
          {p.status === "approved" && auto && (
            <AdminButton onClick={() => setConfirm("send")} disabled={!provider?.razorpayxReady}>Send with RazorpayX</AdminButton>
          )}
          {p.status === "processing" && p.providerPayoutId && <AdminButton variant="outline" onClick={() => act("refresh", {}, "Status updated")}><RefreshCw size={14} /> Check RazorpayX status</AdminButton>}
          {(p.status === "approved" || p.status === "processing" || p.status === "paid") && (
            <AdminButton variant="ghost" onClick={() => setConfirm("mark_failed")}>{p.status === "paid" ? "Bank returned it (mark failed)" : "Mark failed"}</AdminButton>
          )}

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-muted)" }}>History</p>
            <ul className="space-y-1">
              {p.history.map((h, i) => <li key={i} className="text-xs"><b>{h.status}</b> · {when(h.at)} · {h.by}{h.note ? ` · ${h.note}` : ""}</li>)}
            </ul>
          </div>

          <ConfirmDialog open={confirm === "send"} onClose={() => setConfirm(null)} onConfirm={() => { setConfirm(null); void act("send", {}, "Sent to RazorpayX"); }} confirmLabel="Send money" title={`Send ${inr(p.netPaise)} now?`} message="RazorpayX transfers the money to the account above. This cannot be undone from here." />
        </div>
      )}
      {p && (
        <ReasonDialog open={confirm === "reject" || confirm === "mark_failed"} title={confirm === "reject" ? "Reject this payout?" : "Mark this payout failed?"} label={confirm === "reject" ? "Reject" : "Mark failed"}
          reason={reason} setReason={setReason} onClose={() => setConfirm(null)}
          onConfirm={() => { const a = confirm!; setConfirm(null); void act(a, { reason }, a === "reject" ? "Rejected. Money back in the partner's balance." : "Marked failed. Money back in the partner's balance."); }} />
      )}
    </Drawer>
  );
}

function ReasonDialog({ open, title, label, reason, setReason, onClose, onConfirm }: { open: boolean; title: string; label: string; reason: string; setReason: (v: string) => void; onClose: () => void; onConfirm: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-md space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-base font-semibold" style={{ color: "var(--a-fg)" }}>{title}</p>
        <p className="text-sm" style={{ color: "var(--a-muted)" }}>The money goes back to the partner&apos;s balance and they are told the reason.</p>
        <AdminTextarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Reason (the partner sees this)" />
        <div className="flex justify-end gap-2">
          <AdminButton variant="ghost" onClick={onClose}>Back</AdminButton>
          <AdminButton variant="danger" onClick={onConfirm} disabled={reason.trim().length < 5}>{label}</AdminButton>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- one partner's ledger ---------------- */

function BalanceDrawer({ astrologerId, name, onClose, onChanged }: { astrologerId: string; name: string; onClose: () => void; onChanged: () => void }) {
  const { toast } = useAdminToast();
  const [d, setD] = useState<{ balance: EarningsBalance; entries: LedgerEntry[]; nextCursor: string | null; payouts: Payout[] } | null>(null);
  const [amt, setAmt] = useState("");
  const [why, setWhy] = useState("");
  const [key, setKey] = useState(reqId);

  const load = useCallback(async (more?: string) => {
    const r = await astroAdminApi.earnings.of(astrologerId, more);
    if (!r.ok) return toast(r.message, "error");
    setD((cur) => (more && cur ? { ...r.data, entries: [...cur.entries, ...r.data.entries] } : r.data));
  }, [astrologerId, toast]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  async function adjust() {
    const paise = Math.round(Number(amt) * 100);
    if (!Number.isFinite(paise) || paise === 0) return toast("Enter an amount, + to add or − to deduct", "error");
    const r = await astroAdminApi.earnings.adjust(astrologerId, paise, why, key);
    setKey(reqId());
    if (!r.ok) return toast(r.message, "error");
    toast("Adjustment saved", "success");
    setAmt(""); setWhy("");
    await load();
    onChanged();
  }

  return (
    <Drawer open onClose={onClose} title={`${name}: earnings`} subtitle="Ledger, newest first">
      {!d ? <StatsSkeleton count={3} /> : (
        <div className="space-y-5 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Info k="Withdrawable" v={<b>{inr(d.balance.availablePaise)}</b>} />
            <Info k="On hold" v={inr(d.balance.onHoldPaise)} />
            <Info k="In payout" v={inr(d.balance.inPayoutPaise)} />
            <Info k="Paid out" v={inr(d.balance.paidOutPaise)} />
          </div>
          <div className="space-y-2 rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
            <p className="font-semibold">Adjust balance</p>
            <Field label="Amount (₹)" hint="Positive adds, negative deducts. Withdrawable at once."><AdminInput type="number" step={0.01} value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="e.g. 250 or -100" /></Field>
            <Field label="Reason (the partner sees this)"><AdminTextarea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} maxLength={300} /></Field>
            <AdminButton onClick={adjust} disabled={!amt || why.trim().length < 5}>Save adjustment</AdminButton>
          </div>
          <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
            {d.entries.map((e) => (
              <li key={e.id} className="flex items-start gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p style={{ color: "var(--a-fg)" }}>{e.ref.label}</p>
                  <p className="text-xs" style={{ color: "var(--a-muted)" }}>{e.type} · {when(e.at)}{e.netPaise > 0 && Date.parse(e.availableAt) > Date.parse(e.at) ? ` · free ${new Date(e.availableAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}{e.note ? ` · ${e.note}` : ""}</p>
                </div>
                <span className="font-semibold tabular-nums" style={{ color: e.netPaise < 0 ? "#be123c" : "var(--a-fg)" }}>{e.netPaise > 0 ? "+" : ""}{inr(e.netPaise)}</span>
              </li>
            ))}
          </ul>
          {d.nextCursor && <AdminButton variant="outline" onClick={() => load(d.nextCursor!)}>Load more</AdminButton>}
        </div>
      )}
    </Drawer>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--a-border)" }}>
      <p className="text-xs" style={{ color: "var(--a-muted)" }}>{k}</p>
      <div className="mt-0.5" style={{ color: "var(--a-fg)" }}>{v}</div>
    </div>
  );
}

function CopyRow({ k, v, onCopy }: { k: string; v?: string; onCopy: (v?: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span style={{ color: "var(--a-muted)" }}>{k}</span>
      <span className="flex items-center gap-1 font-mono" style={{ color: "var(--a-fg)" }}>{v ?? "-"}{v && <button onClick={() => onCopy(v)} className="rounded p-1 hover:bg-black/[0.06]" aria-label={`Copy ${k}`}><Copy size={12} /></button>}</span>
    </div>
  );
}
