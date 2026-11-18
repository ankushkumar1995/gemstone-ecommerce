"use client";

/**
 * Admin: consultation chats. Tabs Live / Reported / Reviews / All.
 * Open a chat for the full transcript; end a live chat, refund part or all of
 * what the customer paid (to their wallet, never more than charged), and
 * approve or reject a customer rating. Every action is audited server-side.
 */

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AdminButton, AdminInput, AdminTextarea, Badge, Card, ConfirmDialog, Drawer, Field, PageHeader, StatsSkeleton, Tabs, useAdminToast } from "@/app/admin/_components";
import { astroAdminApi } from "@/lib/admin-astro-api";
import type { ConsultMessage, ConsultSession } from "@/modules/consultations/consult.types";

type Tab = "live" | "reported" | "reviews" | "all";

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "-");
const TONE: Record<ConsultSession["status"], "green" | "gold" | "muted" | "rose" | "blue"> = {
  requested: "gold", active: "green", ended: "blue", declined: "muted", missed: "rose", cancelled: "muted",
};
const reqId = () => { try { return crypto.randomUUID().replace(/-/g, ""); } catch { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; } };

export function ConsultationsView() {
  const { toast } = useAdminToast();
  const [tab, setTab] = useState<Tab>("live");
  const [rows, setRows] = useState<ConsultSession[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ session: ConsultSession; messages: ConsultMessage[] } | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [refundRs, setRefundRs] = useState("");
  const [refundWhy, setRefundWhy] = useState("");
  const [refundKey, setRefundKey] = useState("");

  const load = useCallback(async (t: Tab) => {
    const r = await astroAdminApi.consultations.list(t);
    if (r.ok) setRows(r.data.sessions);
    else toast(r.message, "error");
  }, [toast]);

  useEffect(() => {
    const first = setTimeout(() => { setRows(null); void load(tab); }, 0);
    // Live chats change fast: refresh every 10 s on that tab.
    const t = tab === "live" ? setInterval(() => void load(tab), 10_000) : null;
    return () => { clearTimeout(first); if (t) clearInterval(t); };
  }, [tab, load]);

  const openChat = useCallback(async (id: string) => {
    setOpenId(id);
    setDetail(null);
    setRefundRs("");
    setRefundWhy("");
    setRefundKey(reqId());
    const r = await astroAdminApi.consultations.get(id);
    if (r.ok) setDetail(r.data);
    else { toast(r.message, "error"); setOpenId(null); }
  }, [toast]);

  async function after(res: Awaited<ReturnType<typeof astroAdminApi.consultations.end>>, msg: string) {
    if (!res.ok) { toast(res.message, "error"); return false; }
    toast(msg, "success");
    if (openId) await openChat(openId);
    void load(tab);
    return true;
  }

  async function doRefund() {
    if (!detail) return;
    const paise = Math.round(Number(refundRs) * 100);
    if (!Number.isFinite(paise) || paise <= 0) return toast("Enter an amount", "error");
    if (refundWhy.trim().length < 5) return toast("Give a reason (at least 5 characters)", "error");
    await after(await astroAdminApi.consultations.refund(detail.session.id, paise, refundWhy.trim(), refundKey), "Refunded to the customer's wallet.");
  }

  const s = detail?.session;
  const refundable = s ? s.chargedPaise - s.refundedPaise : 0;
  const isOpen = s ? s.status === "requested" || s.status === "active" : false;

  return (
    <div className="space-y-6">
      <PageHeader title="Consultations" subtitle="Live chats, reports and reviews from customer and astrologer chats."
        action={<AdminButton variant="outline" onClick={() => load(tab)}><RefreshCw size={15} /> Refresh</AdminButton>} />
      <Tabs<Tab> variant="pills" value={tab} onChange={setTab} tabs={[
        { value: "live", label: "Live", count: tab === "live" ? rows?.length : undefined },
        { value: "reported", label: "Reported" },
        { value: "reviews", label: "Reviews to check" },
        { value: "all", label: "All" },
      ]} />

      {!rows ? <StatsSkeleton count={3} /> : rows.length === 0 ? (
        <Card className="py-12 text-center"><p className="text-sm" style={{ color: "var(--a-muted)" }}>Nothing here.</p></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide" style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}>
                <th className="px-4 py-3">Chat</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Astrologer</th>
                <th className="px-4 py-3">Minutes</th><th className="px-4 py-3">Paid</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => void openChat(r.id)} className="cursor-pointer border-b hover:bg-black/[0.03]" style={{ borderColor: "var(--a-border)" }}>
                  <td className="px-4 py-3"><p className="font-medium" style={{ color: "var(--a-fg)" }}>{r.sessionNumber}</p><p className="text-xs" style={{ color: "var(--a-muted)" }}>{when(r.requestedAt)}</p></td>
                  <td className="px-4 py-3">{r.customer.name}</td>
                  <td className="px-4 py-3">{r.astrologer.name}</td>
                  <td className="px-4 py-3 tabular-nums">{r.minutesCharged}</td>
                  <td className="px-4 py-3 tabular-nums">{inr(r.chargedPaise - r.refundedPaise)}{r.refundedPaise > 0 && <span className="ml-1 text-xs text-rose-700">(-{inr(r.refundedPaise)})</span>}</td>
                  <td className="px-4 py-3"><Badge tone={TONE[r.status]}>{r.status}</Badge></td>
                  <td className="space-x-1 px-4 py-3">
                    {r.reports.length > 0 && <Badge tone="rose">{r.reports.length} report{r.reports.length > 1 ? "s" : ""}</Badge>}
                    {r.rating && <Badge tone={r.rating.status === "pending" ? "gold" : r.rating.status === "approved" ? "green" : "muted"}>{r.rating.stars}★ {r.rating.status}</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Drawer open={openId !== null} onClose={() => setOpenId(null)} title={s ? `Chat ${s.sessionNumber}` : "Chat"} subtitle={s ? `${s.customer.name} with ${s.astrologer.name}` : undefined}>
        {!detail || !s ? <StatsSkeleton count={3} /> : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Info k="Status" v={<Badge tone={TONE[s.status]}>{s.status}{s.endReason ? ` · ${s.endReason}` : ""}</Badge>} />
              <Info k="Rate" v={`₹${s.rate}/min`} />
              <Info k="Minutes" v={`${s.minutesCharged}${s.freeUsed ? ` (${s.freeUsed} free)` : ""}`} />
              <Info k="Charged" v={inr(s.chargedPaise)} />
              <Info k="Refunded" v={inr(s.refundedPaise)} />
              <Info k="Astrologer earning" v={inr(s.earningPaise)} />
              <Info k="Requested" v={when(s.requestedAt)} />
              <Info k="Ended" v={when(s.endedAt)} />
            </div>

            {isOpen && <AdminButton variant="danger" onClick={() => setConfirmEnd(true)}>End this chat now</AdminButton>}

            {s.reports.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Reports</p>
                {s.reports.map((r, i) => (
                  <p key={i} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900"><b>{r.by}</b> · {when(r.at)}: {r.reason}</p>
                ))}
              </div>
            )}

            {s.rating && (
              <div className="space-y-2 rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Rating {s.rating.stars}/5 <Badge tone={s.rating.status === "pending" ? "gold" : s.rating.status === "approved" ? "green" : "muted"}>{s.rating.status}</Badge></p>
                {s.rating.text && <p className="text-sm" style={{ color: "var(--a-fg)" }}>&ldquo;{s.rating.text}&rdquo;</p>}
                <div className="flex gap-2">
                  {s.rating.status !== "approved" && <AdminButton onClick={async () => { await after(await astroAdminApi.consultations.review(s.id, true), "Review approved."); }}>Approve</AdminButton>}
                  {s.rating.status !== "rejected" && <AdminButton variant="outline" onClick={async () => { await after(await astroAdminApi.consultations.review(s.id, false), "Review hidden."); }}>Reject</AdminButton>}
                </div>
              </div>
            )}

            {!isOpen && refundable > 0 && (
              <div className="space-y-3 rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Refund to wallet (up to {inr(refundable)})</p>
                <Field label="Amount (₹)">
                  <AdminInput type="number" min={0.01} step={0.01} max={refundable / 100} value={refundRs} onChange={(e) => setRefundRs(e.target.value)} />
                </Field>
                <div className="flex gap-2">
                  <button className="text-xs font-medium underline" style={{ color: "var(--a-gold)" }} onClick={() => setRefundRs(String(refundable / 100))}>Full amount</button>
                </div>
                <Field label="Reason">
                  <AdminTextarea rows={2} maxLength={300} value={refundWhy} onChange={(e) => setRefundWhy(e.target.value)} placeholder="Why is this refunded?" />
                </Field>
                <AdminButton onClick={doRefund}>Refund</AdminButton>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Transcript</p>
              {s.question && <p className="mb-2 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--a-gold-soft)" }}>Question: {s.question}</p>}
              {detail.messages.length === 0 ? <p className="text-sm" style={{ color: "var(--a-faint)" }}>No messages.</p> : (
                <div className="space-y-1.5">
                  {detail.messages.map((m) => m.from === "system" ? (
                    <p key={m.seq} className="text-center text-xs" style={{ color: "var(--a-faint)" }}>{m.text}</p>
                  ) : (
                    <div key={m.seq} className="text-sm">
                      <span className="font-semibold" style={{ color: m.from === "astrologer" ? "var(--a-gold)" : "var(--a-fg)" }}>{m.from === "astrologer" ? s.astrologer.name : s.customer.name}</span>
                      <span className="ml-2 text-xs" style={{ color: "var(--a-faint)" }}>{new Date(m.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}{m.masked ? " · contact hidden" : ""}</span>
                      <p className="whitespace-pre-wrap break-words" style={{ color: "var(--a-fg)" }}>{m.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog open={confirmEnd} onClose={() => setConfirmEnd(false)} danger confirmLabel="End chat" title="End this chat?"
        message="The chat closes for both sides. The customer is billed only up to the current minute."
        onConfirm={async () => { setConfirmEnd(false); if (s) await after(await astroAdminApi.consultations.end(s.id), "Chat ended."); }} />
    </div>
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
