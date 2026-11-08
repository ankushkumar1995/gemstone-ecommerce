"use client";

/**
 * My customers (DEMO). People who consulted this partner: sessions, minutes,
 * spend, last visit, private notes and tags. Contact details are never shown;
 * a partner can only reach a customer through the platform (follow-up nudge).
 */

import { useMemo, useState } from "react";
import { Ban, BellRing, Lock, Repeat2, Users, Crown, IndianRupee } from "lucide-react";
import { blockedStore, queueStore, useStore } from "../../_components/demo-store";
import { AdminButton, AdminSelect, AdminTextarea, Avatar, Badge, Card, Drawer, Field, PageHeader, SearchInput, StatCard, StatsSkeleton, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { CHANNEL_LABEL, DemoBanner, Stars, fmtDateTime, inr, nowMs, timeAgo } from "../../_components/demo";
import { MOCK_CUSTOMERS, MOCK_SESSIONS, type MockCustomer } from "../../_components/mock-data";

const TAGS = ["VIP", "Repeat", "Follow up", "Sensitive"];

export default function MyCustomersPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const [list, setList] = useState<MockCustomer[]>(MOCK_CUSTOMERS);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "spent" | "sessions">("recent");
  const [tag, setTag] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [nudged, setNudged] = useState<string[]>([]);
  const blocked = useStore(blockedStore);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = list.filter((c) => (!s || c.name.toLowerCase().includes(s) || c.city.toLowerCase().includes(s)) && (tag === "all" || c.tags.includes(tag)));
    return [...rows].sort((a, b) => (sort === "spent" ? b.spent - a.spent : sort === "sessions" ? b.sessions - a.sessions : Date.parse(b.lastAt) - Date.parse(a.lastAt)));
  }, [list, q, sort, tag]);

  if (loading || !me) return <StatsSkeleton count={4} />;
  const open = list.find((c) => c.id === openId) ?? null;
  const repeat = list.filter((c) => c.sessions > 1).length;

  const update = (id: string, patch: Partial<MockCustomer>) => setList((l) => l.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const isBlocked = (id: string) => blocked.some((b) => b.customerId === id);
  const block = (c: MockCustomer) => {
    blockedStore.set((l) => [{ customerId: c.id, name: firstName(c.name), reason: "Blocked from My customers", at: new Date(nowMs()).toISOString() }, ...l]);
    queueStore.set((q) => q.filter((x) => x.customerId !== c.id));
    toast(`${firstName(c.name)} is blocked. They cannot request, wait for or follow up with you.`, "info");
  };
  const unblock = (id: string) => {
    blockedStore.set((l) => l.filter((b) => b.customerId !== id));
    toast("Unblocked. They can reach you again.", "success");
  };
  const firstName = (n: string) => `${n.split(" ")[0]} ${n.split(" ")[1]?.[0] ?? ""}.`;

  return (
    <div className="space-y-6">
      <PageHeader title="My customers" subtitle="Know your regulars. Notes are private to you." />
      <DemoBanner />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Users} value={list.length} label="Customers" tone="royal" />
        <StatCard icon={Repeat2} value={`${Math.round((repeat / list.length) * 100)}%`} label="Came back" tone="green" />
        <StatCard icon={Crown} value={list.filter((c) => c.tags.includes("VIP")).length} label="VIP" tone="gold" />
        <StatCard icon={IndianRupee} value={inr(Math.round(list.reduce((a, c) => a + c.spent, 0) / list.length))} label="Avg spend" tone="blue" />
      </div>

      <Card className="p-4">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_11rem_11rem]">
          <SearchInput value={q} onChange={setQ} placeholder="Search name or city" />
          <AdminSelect value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag"><option value="all">All tags</option>{TAGS.map((t) => <option key={t}>{t}</option>)}</AdminSelect>
          <AdminSelect value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort"><option value="recent">Most recent</option><option value="spent">Top spend</option><option value="sessions">Most sessions</option></AdminSelect>
        </div>
        <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
          {shown.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => { setOpenId(c.id); setNote(c.note ?? ""); }} className="flex w-full items-center gap-3 py-3 text-left hover:bg-black/[0.02]">
                <Avatar name={c.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium" style={{ color: "var(--a-fg)" }}>{firstName(c.name)} {c.tags.map((t) => <Badge key={t} tone={t === "VIP" ? "gold" : "muted"}>{t}</Badge>)}</p>
                  <p className="text-xs" style={{ color: "var(--a-muted)" }}>{c.city} · {c.sign} · last {timeAgo(c.lastAt)}</p>
                </div>
                <div className="text-right text-xs" style={{ color: "var(--a-muted)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{inr(c.spent)}</p>
                  <p>{c.sessions} sessions · {c.minutes} min</p>
                </div>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="py-10 text-center text-sm" style={{ color: "var(--a-faint)" }}>No customers match.</li>}
        </ul>
      </Card>

      <Card className="p-5">
        <p className="mb-1 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Ban size={16} /> Blocked customers</p>
        <p className="mb-3 text-xs" style={{ color: "var(--a-muted)" }}>Blocked customers cannot send you requests, join your waitlist or ask follow-ups. They are not told they are blocked; you just appear unavailable.</p>
        {blocked.length === 0 ? <p className="text-sm" style={{ color: "var(--a-faint)" }}>No one is blocked.</p> : (
          <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
            {blocked.map((b) => (
              <li key={b.customerId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span><span style={{ color: "var(--a-fg)" }}>{b.name}</span><span className="block text-xs" style={{ color: "var(--a-muted)" }}>{b.reason} · {timeAgo(b.at)}{b.sessionId ? ` · ${b.sessionId}` : ""}</span></span>
                <AdminButton variant="ghost" onClick={() => unblock(b.customerId)}>Unblock</AdminButton>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open ? firstName(open.name) : ""} subtitle={open ? `${open.city} · ${open.sign} rashi` : undefined}>
        {open && (
          <div className="space-y-5 text-sm">
            <p className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--a-surface-2)", color: "var(--a-muted)" }}><Lock size={13} /> Phone and email stay hidden. Use a follow-up nudge to reach them through the app.</p>
            <dl className="grid grid-cols-2 gap-y-2">
              <dt style={{ color: "var(--a-muted)" }}>Sessions</dt><dd className="text-right">{open.sessions}</dd>
              <dt style={{ color: "var(--a-muted)" }}>Minutes</dt><dd className="text-right">{open.minutes}</dd>
              <dt style={{ color: "var(--a-muted)" }}>Total spend</dt><dd className="text-right">{inr(open.spent)}</dd>
              <dt style={{ color: "var(--a-muted)" }}>Their rating</dt><dd className="text-right">{open.rating ? <Stars value={open.rating} size={12} /> : "Not rated"}</dd>
            </dl>
            <Field label="Tags">
              <div className="flex flex-wrap gap-1.5">
                {TAGS.map((t) => {
                  const on = open.tags.includes(t);
                  return <button key={t} type="button" aria-pressed={on} onClick={() => update(open.id, { tags: on ? open.tags.filter((x) => x !== t) : [...open.tags, t] })} className="rounded-full border px-2.5 py-1 text-xs" style={{ borderColor: on ? "var(--a-gold)" : "var(--a-border)", color: on ? "var(--a-gold)" : "var(--a-muted)" }}>{t}</button>;
                })}
              </div>
            </Field>
            <Field label="Private note">
              <AdminTextarea rows={3} value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} placeholder="Shows in the side panel during your next session with them" />
              <AdminButton className="mt-2" variant="outline" onClick={() => { update(open.id, { note: note.trim() || undefined }); toast("Note saved", "success"); }}>Save note</AdminButton>
            </Field>
            <div>
              <p className="mb-2 font-semibold">Past sessions</p>
              <ul className="space-y-1.5">
                {MOCK_SESSIONS.filter((s) => s.customerId === open.id).slice(0, 6).map((s) => (
                  <li key={s.id} className="flex justify-between text-xs" style={{ color: "var(--a-muted)" }}><span>{fmtDateTime(s.startedAt)} · {CHANNEL_LABEL[s.channel]} · {s.topic}</span><span>{s.minutes} min</span></li>
                ))}
              </ul>
            </div>
            <AdminButton className="w-full" disabled={nudged.includes(open.id) || isBlocked(open.id)} onClick={() => { setNudged((n) => [...n, open.id]); toast("Follow-up sent as an app notification", "success"); }}>
              <BellRing size={15} /> {nudged.includes(open.id) ? "Follow-up sent" : "Send follow-up nudge"}
            </AdminButton>
            <p className="text-[11px]" style={{ color: "var(--a-faint)" }}>One nudge per customer per week. The customer can turn these off.</p>
            {isBlocked(open.id) ? (
              <AdminButton className="w-full" variant="outline" onClick={() => unblock(open.id)}>Unblock</AdminButton>
            ) : (
              <AdminButton className="w-full" variant="ghost" onClick={() => block(open)}><Ban size={15} /> Block this customer</AdminButton>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
