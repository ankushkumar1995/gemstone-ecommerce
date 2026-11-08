"use client";

/**
 * Pooja bookings: work queues (today, needs pandit, proof pending, prasad to
 * ship, ready to complete, unpaid), plus upcoming / completed / cancelled /
 * all, with pooja, pandit, date and text filters. Rows open the full detail page.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarDays, Clock, Flame, PhoneCall, Plus, Truck, UserPlus, Video } from "lucide-react";
import { poojaAdminApi, type BookingCounts } from "@/lib/admin-pooja-api";
import { istToday, slotInstant } from "@/modules/poojas/pooja.rules";
import type { Pandit, PoojaBooking, PoojaListItem } from "@/modules/poojas/pooja.types";
import { AdminButton, AdminInput, AdminSelectPro, DataTable, PageHeader, StatCard, StatsSkeleton, StatusPill, Tabs, useAdminToast, type Column } from "../../../_components";
import { BOOKING_STATUS, PAYMENT_STATUS, PRASAD_STATUS, fmtSlot, inr } from "../pooja-meta";

type Q = "today" | "pandit" | "proof" | "prasad" | "complete" | "unpaid" | "upcoming" | "completed" | "cancelled" | "all";

export function PoojaBookingsManager() {
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useAdminToast();
  const [q, setQ] = useState<Q>((sp.get("queue") as Q) || "today");
  // With no queue in the URL, open "New requests" once if website requests are waiting.
  const autoPick = useRef(!sp.get("queue"));
  const [poojaId, setPoojaId] = useState(sp.get("poojaId") ?? "");
  const [panditId, setPanditId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<PoojaBooking[]>([]);
  const [counts, setCounts] = useState<BookingCounts | null>(null);
  const [poojas, setPoojas] = useState<PoojaListItem[]>([]);
  const [pandits, setPandits] = useState<Pandit[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let alive = true;
    void Promise.all([poojaAdminApi.poojas.list(), poojaAdminApi.pandits.list()]).then(([p, d]) => {
      if (!alive) return;
      if (p.ok) setPoojas(p.data);
      if (d.ok) setPandits(d.data);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    const today = istToday(Date.now());
    const base = { poojaId: poojaId || undefined, panditId: panditId || undefined, from: from || undefined, to: to || undefined };
    const filters: Record<Q, Parameters<typeof poojaAdminApi.bookings.list>[0]> = {
      today: { ...base, from: today, to: today, status: ["confirmed", "assigned", "in_progress", "performed", "completed"] },
      pandit: { ...base, status: ["confirmed"] },
      proof: { ...base, status: ["assigned", "in_progress"] },
      prasad: { ...base, status: ["performed"] },
      complete: { ...base, status: ["performed"] },
      unpaid: { ...base, status: ["pending_payment"] },
      upcoming: { ...base, from: base.from ?? today, status: ["pending_payment", "confirmed", "assigned"] },
      completed: { ...base, status: ["completed"] },
      cancelled: { ...base, status: ["cancelled"] },
      all: base,
    };
    void Promise.all([poojaAdminApi.bookings.list(filters[q]), poojaAdminApi.bookings.counts()]).then(([r, c]) => {
      if (!alive) return;
      if (r.ok) {
        let list = r.data;
        if (q === "proof") list = list.filter((b) => b.status === "in_progress" || b.slot.date < today);
        if (q === "prasad") list = list.filter((b) => ["pending", "packed", "returned"].includes(b.prasad.status));
        if (q === "complete") list = list.filter((b) => ["not_required", "delivered"].includes(b.prasad.status));
        if (q === "completed" || q === "cancelled" || q === "all") list = [...list].reverse();
        setRows(list);
        setNow(Date.now());
      } else toast(r.message, "error");
      if (c.ok) {
        setCounts(c.data);
        if (autoPick.current) {
          autoPick.current = false;
          if (c.data.unpaid > 0 && c.data.today === 0 && q === "today") { setLoading(true); setQ("unpaid"); }
        }
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [q, poojaId, panditId, from, to, reload, toast]);


  const late = (b: PoojaBooking) => {
    if (["assigned", "in_progress"].includes(b.status) && slotInstant(b.slot.date, b.slot.time) + b.policy.proofSlaHours * 3_600_000 < now) return "Proof overdue";
    if (b.status === "confirmed" && slotInstant(b.slot.date, b.slot.time) - 12 * 3_600_000 < now) return "Pooja soon, no pandit";
    return null;
  };

  const columns: Column<PoojaBooking>[] = [
    { key: "no", header: "Booking", searchable: true, sortable: true, accessor: (b) => `${b.bookingNumber} ${b.customer.name} ${b.customer.phone}`,
      cell: (b) => <div><p className="font-mono text-xs font-semibold" style={{ color: "var(--a-fg)" }}>{b.bookingNumber}</p><p className="text-xs" style={{ color: "var(--a-muted)" }}>{b.customer.name} · {b.customer.phone}</p></div> },
    { key: "pooja", header: "Pooja", searchable: true, accessor: (b) => b.pooja.title, cell: (b) => <div><p className="text-sm" style={{ color: "var(--a-fg)" }}>{b.pooja.title}</p><p className="text-xs" style={{ color: "var(--a-faint)" }}>{b.package.name} · {b.members.length} name{b.members.length > 1 ? "s" : ""}</p></div> },
    { key: "slot", header: "When", sortable: true, accessor: (b) => b.slot.key, cell: (b) => { const l = late(b); return <div><p className="text-sm" style={{ color: "var(--a-fg)" }}>{fmtSlot(b.slot.date, b.slot.time)}</p>{l && <p className="flex items-center gap-1 text-[11px] text-rose-700"><AlertTriangle size={11} />{l}</p>}</div>; } },
    { key: "pandit", header: "Pandit", accessor: (b) => b.panditName, cell: (b) => <span className="text-sm" style={{ color: b.panditName ? "var(--a-fg)" : "var(--a-faint)" }}>{b.panditName || "–"}</span> },
    { key: "status", header: "Status", filterable: true, filterOptions: Object.keys(BOOKING_STATUS), accessor: (b) => b.status, cell: (b) => <StatusPill tone={BOOKING_STATUS[b.status].tone}>{BOOKING_STATUS[b.status].label}</StatusPill> },
    { key: "pay", header: "Payment", accessor: (b) => b.payment.status, cell: (b) => <span className="text-xs"><StatusPill tone={PAYMENT_STATUS[b.payment.status].tone}>{PAYMENT_STATUS[b.payment.status].label}</StatusPill></span> },
    { key: "prasad", header: "Prasad", accessor: (b) => b.prasad.status, cell: (b) => b.prasad.status === "not_required" ? <span style={{ color: "var(--a-faint)" }}>–</span> : <StatusPill tone={PRASAD_STATUS[b.prasad.status].tone}>{PRASAD_STATUS[b.prasad.status].label}</StatusPill> },
    { key: "total", header: "Total", sortable: true, align: "right", accessor: (b) => b.pricing.total, cell: (b) => <span className="font-semibold">{inr(b.pricing.total)}</span> },
  ];

  const tabs: { value: Q; label: string; count?: number }[] = [
    { value: "unpaid", label: "New requests", count: counts?.unpaid },
    { value: "today", label: "Today", count: counts?.today },
    { value: "pandit", label: "Needs pandit", count: counts?.needsPandit },
    { value: "proof", label: "Proof pending", count: counts?.proofPending },
    { value: "prasad", label: "Prasad to ship", count: counts?.prasadToShip },
    { value: "complete", label: "Ready to close" },
    { value: "upcoming", label: "Upcoming" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
    { value: "all", label: "All" },
  ];
  const changeQ = (v: Q) => { setLoading(true); setQ(v); };

  return (
    <div>
      <PageHeader title="Pooja bookings" subtitle="Assign pandits, share proof, ship prasad and handle changes."
        action={<div className="flex gap-2"><Link href="/admin/poojas"><AdminButton variant="outline"><Flame size={16} /> Poojas</AdminButton></Link><Link href="/admin/poojas/bookings/new"><AdminButton><Plus size={16} /> New booking</AdminButton></Link></div>} />
      {!counts ? <StatsSkeleton count={4} /> : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
          <button type="button" onClick={() => changeQ("unpaid")} className="text-left" aria-label="Show new requests">
            <StatCard icon={PhoneCall} value={counts.unpaid} label="New requests to call" tone="green" />
          </button>
          <StatCard icon={CalendarDays} value={counts.today} label="Poojas today" tone="royal" />
          <StatCard icon={UserPlus} value={counts.needsPandit} label="Need a pandit" tone="blue" />
          <StatCard icon={Video} value={counts.proofLate} label={`Proof overdue (${counts.proofPending} pending)`} tone="rose" />
          <StatCard icon={Truck} value={counts.prasadToShip} label={`Prasad to ship${counts.prasadLate ? ` (${counts.prasadLate} late)` : ""}`} tone="gold" />
        </div>
      )}

      <div className="mt-6"><Tabs<Q> variant="pills" value={q} onChange={changeQ} tabs={tabs} /></div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_10rem_10rem_auto]">
        <AdminSelectPro value={poojaId} onChange={(e) => { setLoading(true); setPoojaId(e.target.value); }} aria-label="Pooja"><option value="">All poojas</option>{poojas.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</AdminSelectPro>
        <AdminSelectPro value={panditId} onChange={(e) => { setLoading(true); setPanditId(e.target.value); }} aria-label="Pandit"><option value="">All pandits</option>{pandits.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</AdminSelectPro>
        <AdminInput type="date" value={from} onChange={(e) => { setLoading(true); setFrom(e.target.value); }} aria-label="From date" disabled={q === "today"} />
        <AdminInput type="date" value={to} onChange={(e) => { setLoading(true); setTo(e.target.value); }} aria-label="To date" disabled={q === "today"} />
        <AdminButton variant="ghost" onClick={() => { setLoading(true); setPoojaId(""); setPanditId(""); setFrom(""); setTo(""); }}>Clear</AdminButton>
      </div>
      {from && to && from > to && <p className="mt-2 text-xs text-rose-700">The from date is after the to date.</p>}

      <div className="mt-4">
        <DataTable
          data={rows}
          columns={columns}
          getRowId={(b) => b.id}
          loading={loading}
          onRefresh={() => { setLoading(true); setReload((n) => n + 1); }}
          exportName={`pooja-bookings-${q}`}
          searchPlaceholder="Booking no., name or phone"
          onRowClick={(b) => router.push(`/admin/poojas/bookings/${b.id}`)}
          emptyTitle="Nothing here"
          emptyMessage={q === "today" ? "No poojas today." : "No bookings match these filters."}
        />
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: "var(--a-faint)" }}><Clock size={12} /> Times are IST. Showing up to 500 bookings per view; narrow by date for older records.</p>
    </div>
  );
}
