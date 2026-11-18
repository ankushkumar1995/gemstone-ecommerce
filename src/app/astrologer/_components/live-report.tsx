"use client";

/**
 * After-live report (partner panel): viewers graph, new followers, gifts,
 * questions and the chats this live brought. Used right after a live ends
 * and from Past lives (/astrologer/live/:id).
 */

import { useCallback, useState } from "react";
import { Gift, IndianRupee, MessageSquare, Mic, RefreshCw, UserPlus, Users } from "lucide-react";
import { AdminButton, Badge, Card, StatsSkeleton, useAdminToast, useOnMount } from "@/app/admin/_components";
import { partnerApi, type LiveReport } from "@/lib/astrologer-api";

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const dur = (secs: number) => {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return h ? `${h} h ${m} min` : `${Math.max(m, secs > 0 ? 1 : 0)} min`;
};
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export function LiveReportCard({ liveId, onReady }: { liveId: string; onReady?: (r: LiveReport) => void }) {
  const { toast } = useAdminToast();
  const [r, setR] = useState<LiveReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const x = await partnerApi.liveTools.report(liveId);
    setBusy(false);
    if (!x.ok) { setErr(x.message); toast(x.message, "error"); return; }
    setErr(null);
    setR(x.data.report);
    onReady?.(x.data.report);
  }, [liveId, toast, onReady]);
  useOnMount(() => { void load(); });

  if (!r) {
    return err ? (
      <Card className="space-y-3 p-6 text-center">
        <p className="text-sm" style={{ color: "var(--a-muted)" }}>{err}</p>
        <AdminButton variant="outline" onClick={load} loading={busy}><RefreshCw size={15} /> Try again</AdminButton>
      </Card>
    ) : <StatsSkeleton count={4} />;
  }
  const live = r.status === "live";

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold" style={{ color: "var(--a-fg)" }}>{r.title}</p>
            <p className="text-xs" style={{ color: "var(--a-muted)" }}>
              {r.liveNumber} · {new Date(r.startedAt!).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {dur(r.durationSec)}
              {r.endText ? ` · ${r.endText}` : ""}
            </p>
            {r.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{r.tags.map((t) => <Badge key={t} tone="muted">{t}</Badge>)}</div>}
          </div>
          {live && <Badge tone="rose">Still live: numbers so far</Badge>}
          <AdminButton variant="outline" onClick={load} loading={busy}><RefreshCw size={15} /> Refresh</AdminButton>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Big icon={IndianRupee} k="Total earned" v={inr(r.earnings.totalPaise)} sub={`Live ${inr(r.earnings.livePaise)} + chats ${inr(r.earnings.chatPaise)}`} />
          <Big icon={Users} k="Viewers" v={String(r.viewers.unique)} sub={`Most at once ${r.viewers.peak}${r.viewers.avg !== null ? ` · avg ${r.viewers.avg}` : ""}`} />
          <Big icon={UserPlus} k="New followers" v={`+${r.followers.gained}`} sub={`${r.followers.fromLive} from the live screen · ${r.followers.total} total`} />
          <Big icon={MessageSquare} k="Chats from this live" v={String(r.chats.started)} sub={`${r.chats.joinedLine} joined your line · ${r.chats.minutes} min`} />
        </div>
      </Card>

      <Card className="p-5">
        <p className="mb-3 text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Watching during the live</p>
        <ViewerGraph samples={r.viewers.samples} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}><Gift size={15} /> Gifts · {r.gifts.count} · {inr(r.gifts.paise)}</p>
          {r.gifts.count === 0 ? <p className="text-sm" style={{ color: "var(--a-faint)" }}>No gifts in this live.</p> : (
            <div className="space-y-4">
              <ul className="space-y-2">
                {r.gifts.byGift.map((g) => (
                  <li key={g.id} className="flex items-center gap-3 text-sm">
                    <span className="text-lg">{g.emoji}</span>
                    <span className="flex-1" style={{ color: "var(--a-fg)" }}>{g.name} ×{g.count}</span>
                    <Bar value={g.paise} max={r.gifts.byGift[0]?.paise ?? 1} />
                    <span className="w-20 text-right tabular-nums font-medium" style={{ color: "var(--a-fg)" }}>{inr(g.paise)}</span>
                  </li>
                ))}
              </ul>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-muted)" }}>Top gifters</p>
                <ol className="space-y-1 text-sm">
                  {r.gifts.topGifters.map((w, i) => (
                    <li key={`${w.name}-${i}`} className="flex justify-between"><span style={{ color: "var(--a-fg)" }}>{i + 1}. {w.name} <span style={{ color: "var(--a-muted)" }}>({w.count})</span></span><span className="tabular-nums">{inr(w.paise)}</span></li>
                  ))}
                </ol>
              </div>
            </div>
          )}
          <p className="mt-3 text-[11px]" style={{ color: "var(--a-faint)" }}>Gift values are what viewers paid. Your share is after {r.commissionPct}% platform commission.</p>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}><MessageSquare size={15} /> 1-to-1 chats this live brought</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Mini k="Joined your chat line" v={r.chats.joinedLine} />
              <Mini k="Took their turn" v={r.chats.tookTurn} />
              <Mini k="Paid chats (live + 2 h after)" v={r.chats.started} />
              <Mini k="Earned from them" v={inr(r.chats.earningPaise)} />
            </div>
            <p className="mt-2 text-[11px]" style={{ color: "var(--a-faint)" }}>Counts chats with people who watched this live or joined your line from it, started up to 2 hours after it ended. Tips included.</p>
          </Card>
          <Card className="p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}><Mic size={15} /> Questions and comments</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Mini k="Questions asked" v={r.engagement.questionsAsked} />
              <Mini k="Answered / skipped" v={`${r.engagement.questionsAnswered} / ${r.engagement.questionsSkipped}`} />
              <Mini k="Super Chats kept" v={`${r.engagement.superChats} · ${inr(r.engagement.superChatsKeptPaise)}`} />
              <Mini k="Super Chats refunded" v={r.engagement.superChatsRefunded} />
              <Mini k="Comments" v={r.engagement.comments} />
              <Mini k="Likes" v={r.engagement.likes.toLocaleString("en-IN")} />
            </div>
            {r.engagement.reminders > 0 && <p className="mt-2 text-xs" style={{ color: "var(--a-muted)" }}>{r.engagement.reminders} people had asked to be reminded.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Watching count over time. A point about every minute; hover for the exact number. */
function ViewerGraph({ samples }: { samples: { at: string; n: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (samples.length < 2) {
    return <p className="py-8 text-center text-sm" style={{ color: "var(--a-faint)" }}>{samples.length ? `${samples[0].n} watching at ${time(samples[0].at)}. The graph fills in as the live goes on.` : "No graph for this live. Graphs are recorded for lives from now on."}</p>;
  }
  const W = 600, H = 160, P = 4;
  const max = Math.max(1, ...samples.map((s) => s.n));
  const t0 = Date.parse(samples[0].at), t1 = Date.parse(samples[samples.length - 1].at);
  const span = Math.max(1, t1 - t0);
  const pts = samples.map((s) => [P + ((Date.parse(s.at) - t0) / span) * (W - 2 * P), H - P - (s.n / max) * (H - 2 * P)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - P} L${pts[0][0].toFixed(1)},${H - P} Z`;
  const peakI = samples.reduce((b, s, i) => (s.n > samples[b].n ? i : b), 0);
  const h = hover ?? peakI;
  const mid = samples[Math.floor(samples.length / 2)];

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex h-40 flex-col justify-between text-[10px] tabular-nums" style={{ color: "var(--a-faint)" }}><span>{max}</span><span>{Math.round(max / 2)}</span><span>0</span></div>
        <div className="relative flex-1">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label={`Viewers over time, most ${max}`}
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - box.left) / box.width) * W;
              let best = 0;
              pts.forEach(([px], i) => { if (Math.abs(px - x) < Math.abs(pts[best][0] - x)) best = i; });
              setHover(best);
            }}>
            <defs>
              <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e6b43a" stopOpacity="0.35" /><stop offset="100%" stopColor="#e6b43a" stopOpacity="0" /></linearGradient>
            </defs>
            {[0.5, 1].map((f) => <line key={f} x1={0} x2={W} y1={H - P - f * (H - 2 * P)} y2={H - P - f * (H - 2 * P)} stroke="currentColor" strokeOpacity="0.08" vectorEffect="non-scaling-stroke" />)}
            <path d={area} fill="url(#vg)" />
            <path d={line} fill="none" stroke="#c9942a" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <line x1={pts[h][0]} x2={pts[h][0]} y1={0} y2={H} stroke="#c9942a" strokeOpacity="0.4" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="pointer-events-none absolute -top-1 rounded-md px-2 py-1 text-xs font-medium shadow"
            style={{ left: `clamp(0px, calc(${(pts[h][0] / W) * 100}% - 40px), calc(100% - 90px))`, background: "var(--a-surface)", color: "var(--a-fg)", border: "1px solid var(--a-border)" }}>
            {samples[h].n} at {time(samples[h].at)}{hover === null ? " (most)" : ""}
          </div>
          <div className="mt-1 flex justify-between text-[10px]" style={{ color: "var(--a-faint)" }}><span>{time(samples[0].at)}</span><span>{time(mid.at)}</span><span>{time(samples[samples.length - 1].at)}</span></div>
        </div>
      </div>
    </div>
  );
}

function Big({ icon: Icon, k, v, sub }: { icon: typeof Users; k: string; v: string; sub: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
      <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--a-muted)" }}><Icon size={13} /> {k}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: "var(--a-fg)" }}>{v}</p>
      <p className="mt-0.5 text-[11px]" style={{ color: "var(--a-faint)" }}>{sub}</p>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: "var(--a-gold-soft)" }}>
      <p className="text-[11px]" style={{ color: "var(--a-muted)" }}>{k}</p>
      <p className="font-semibold tabular-nums" style={{ color: "var(--a-fg)" }}>{v}</p>
    </div>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  return <span className="hidden h-1.5 w-24 overflow-hidden rounded-full sm:block" style={{ background: "var(--a-border)" }}><span className="block h-full rounded-full" style={{ width: `${Math.max(4, (value / Math.max(max, 1)) * 100)}%`, background: "#c9942a" }} /></span>;
}

