"use client";

/**
 * Admin: live sessions. Tabs Live now / Scheduled / All. Open one to read its
 * comments (hidden ones are marked), see the question queue, hide a comment
 * for everyone, feature it (pinned to the top of the app feed) or end the
 * live. Every action is audited server-side.
 */

import { useCallback, useEffect, useState } from "react";
import { EyeOff, RefreshCw, Star } from "lucide-react";
import { AdminButton, Badge, Card, ConfirmDialog, Drawer, PageHeader, StatsSkeleton, Tabs, useAdminToast } from "@/app/admin/_components";
import { astroAdminApi } from "@/lib/admin-astro-api";
import type { LiveEvent, LiveQueueItem, LiveSession } from "@/modules/live/live.types";

type Tab = "live" | "scheduled" | "all";
const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "-");
const TONE: Record<LiveSession["status"], "green" | "gold" | "muted" | "blue"> = { live: "green", scheduled: "gold", ended: "blue", cancelled: "muted" };

export function LiveAdminView() {
  const { toast } = useAdminToast();
  const [tab, setTab] = useState<Tab>("live");
  const [rows, setRows] = useState<LiveSession[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ live: LiveSession; viewers: number; events: (LiveEvent & { hidden: boolean; filtered?: boolean })[]; queue: LiveQueueItem[] } | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const load = useCallback(async (t: Tab) => {
    const r = await astroAdminApi.live.list(t);
    if (r.ok) setRows(r.data.lives);
    else toast(r.message, "error");
  }, [toast]);

  useEffect(() => {
    const first = setTimeout(() => { setRows(null); void load(tab); }, 0);
    const t = tab === "live" ? setInterval(() => void load(tab), 10_000) : null;
    return () => { clearTimeout(first); if (t) clearInterval(t); };
  }, [tab, load]);

  const open = useCallback(async (id: string) => {
    setOpenId(id);
    setDetail(null);
    const r = await astroAdminApi.live.get(id);
    if (r.ok) setDetail(r.data);
    else { toast(r.message, "error"); setOpenId(null); }
  }, [toast]);

  const s = detail?.live;
  const isOpen = s ? s.status === "live" || s.status === "scheduled" : false;

  return (
    <div className="space-y-6">
      <PageHeader title="Live sessions" subtitle="Astrologers live for everyone: comments, gifts and questions."
        action={<AdminButton variant="outline" onClick={() => load(tab)}><RefreshCw size={15} /> Refresh</AdminButton>} />
      <Tabs<Tab> variant="pills" value={tab} onChange={setTab} tabs={[
        { value: "live", label: "Live now", count: tab === "live" ? rows?.length : undefined },
        { value: "scheduled", label: "Scheduled" },
        { value: "all", label: "All" },
      ]} />

      {!rows ? <StatsSkeleton count={3} /> : rows.length === 0 ? (
        <Card className="py-12 text-center"><p className="text-sm" style={{ color: "var(--a-muted)" }}>Nothing here.</p></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide" style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}>
                <th className="px-4 py-3">Live</th><th className="px-4 py-3">Astrologer</th><th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Viewers</th><th className="px-4 py-3">Gifts</th><th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => void open(r.id)} className="cursor-pointer border-b hover:bg-black/[0.03]" style={{ borderColor: "var(--a-border)" }}>
                  <td className="px-4 py-3"><p className="font-medium" style={{ color: "var(--a-fg)" }}>{r.featured && <Star size={13} className="mr-1 inline fill-current" style={{ color: "var(--a-gold)" }} aria-label="Featured" />}{r.title}</p><p className="text-xs" style={{ color: "var(--a-muted)" }}>{r.liveNumber}</p></td>
                  <td className="px-4 py-3">{r.astrologer.name}</td>
                  <td className="px-4 py-3">{when(r.startedAt ?? r.scheduledAt)}</td>
                  <td className="px-4 py-3 tabular-nums">{r.uniqueViewers} (peak {r.peakViewers})</td>
                  <td className="px-4 py-3 tabular-nums">{r.giftCount} · {inr(r.giftsPaise)}</td>
                  <td className="px-4 py-3"><Badge tone={TONE[r.status]}>{r.status}{r.endReason ? ` · ${r.endReason}` : ""}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Drawer open={openId !== null} onClose={() => setOpenId(null)} title={s ? s.title : "Live"} subtitle={s ? `${s.liveNumber} · ${s.astrologer.name}` : undefined}>
        {!detail || !s ? <StatsSkeleton count={3} /> : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Info k="Status" v={<Badge tone={TONE[s.status]}>{s.status}</Badge>} />
              <Info k="Watching now" v={String(detail.viewers)} />
              <Info k="Started" v={when(s.startedAt)} />
              <Info k="Ended" v={when(s.endedAt)} />
              <Info k="Viewers (peak)" v={`${s.uniqueViewers} (${s.peakViewers})`} />
              <Info k="Likes" v={s.likes.toLocaleString("en-IN")} />
              <Info k="Gifts" v={`${s.giftCount} · ${inr(s.giftsPaise)}`} />
              <Info k="Astrologer earning" v={inr(s.earningPaise)} />
              <Info k="Topics" v={s.tags?.length ? s.tags.join(", ") : "-"} />
              <Info k="Joined chat line" v={String(s.chatLeads ?? 0)} />
            </div>
            {isOpen && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium" style={{ color: "var(--a-fg)" }}>{s.featured ? "Featured" : "Not featured"}</p>
                  <p className="text-xs" style={{ color: "var(--a-muted)" }}>Featured lives show first on the app Live tab and stories for everyone, with a Featured tag.</p>
                </div>
                <AdminButton variant={s.featured ? "outline" : "primary"} onClick={async () => {
                  const r = await astroAdminApi.live.feature(s.id, !s.featured);
                  if (!r.ok) return toast(r.message, "error");
                  toast(r.data.live.featured ? "Live featured" : "Removed from featured", "success");
                  void open(s.id);
                  void load(tab);
                }}><Star size={15} /> {s.featured ? "Remove from featured" : "Feature this live"}</AdminButton>
              </div>
            )}
            {isOpen && <AdminButton variant="danger" onClick={() => setConfirmEnd(true)}>{s.status === "live" ? "End this live now" : "Cancel this scheduled live"}</AdminButton>}

            {detail.queue.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Questions</p>
                <ul className="space-y-1 text-sm">
                  {detail.queue.map((q) => <li key={q.id}><b>{q.name}:</b> {q.question} <Badge tone="muted">{q.status}</Badge></li>)}
                </ul>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Comments and gifts</p>
              {detail.events.length === 0 ? <p className="text-sm" style={{ color: "var(--a-faint)" }}>Nothing yet.</p> : (
                <div className="space-y-1.5">
                  {detail.events.map((e) => e.kind === "system" ? (
                    <p key={e.seq} className="text-center text-xs" style={{ color: "var(--a-faint)" }}>{e.text}</p>
                  ) : (
                    <div key={e.seq} className={`flex items-start gap-2 text-sm ${e.hidden ? "opacity-50" : ""}`}>
                      <p className="flex-1 break-words">
                        <b style={{ color: e.by === "astrologer" ? "var(--a-gold)" : "var(--a-fg)" }}>{e.by === "astrologer" ? s.astrologer.name : e.name}</b>{" "}
                        {e.kind === "gift" ? `${e.gift?.emoji} ${e.gift?.name} (₹${e.gift?.price})` : e.text}
                        <span className="ml-2 text-xs" style={{ color: "var(--a-faint)" }}>{new Date(e.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
                        {e.hidden && <Badge tone="rose">hidden</Badge>}
                        {e.filtered && <Badge tone="gold">filtered: only the sender saw it</Badge>}
                      </p>
                      {!e.hidden && e.kind === "comment" && (
                        <button className="rounded p-1 hover:bg-black/[0.06]" title="Hide for everyone" aria-label="Hide for everyone"
                          onClick={async () => { const r = await astroAdminApi.live.hide(s.id, e.seq); if (!r.ok) toast(r.message, "error"); else { toast("Comment hidden", "success"); void open(s.id); } }}>
                          <EyeOff size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog open={confirmEnd} onClose={() => setConfirmEnd(false)} danger confirmLabel="Yes, end it" title="End this live?"
        message="Viewers see that the live was ended by support. Waiting questions are closed."
        onConfirm={async () => {
          setConfirmEnd(false);
          if (!s) return;
          const r = await astroAdminApi.live.end(s.id);
          if (!r.ok) return toast(r.message, "error");
          toast("Live ended.", "success");
          void open(s.id);
          void load(tab);
        }} />
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
