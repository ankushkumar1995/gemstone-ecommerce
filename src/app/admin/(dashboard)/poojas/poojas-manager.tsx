"use client";

/** Pooja catalog: stats, status tabs, table with quick actions. Create/edit open full pages. */

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CalendarDays, Copy, Flame, IndianRupee, Pause, Pencil, Play, Plus, Tags, Trash2, Users } from "lucide-react";
import { poojaAdminApi, type BookingCounts } from "@/lib/admin-pooja-api";
import { PACKAGE_LABEL, type PoojaListItem, type PoojaStatus } from "@/modules/poojas/pooja.types";
import { CategoryDrawer, useCategories } from "./pooja-categories";
import { AdminButton, ConfirmDialog, DataTable, PageHeader, StatCard, StatsSkeleton, StatusPill, Tabs, useAdminToast, useOnMount, type Column } from "../../_components";
import { POOJA_STATUS, inr } from "./pooja-meta";

type TabKey = "all" | PoojaStatus;

export function PoojasManager() {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [rows, setRows] = useState<PoojaListItem[]>([]);
  const [counts, setCounts] = useState<BookingCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");
  const [askDelete, setAskDelete] = useState<PoojaListItem | null>(null);
  const [manageCats, setManageCats] = useState(false);
  const { cats, reload: reloadCats } = useCategories();
  const catName = (key: string) => cats?.find((c) => c.key === key)?.name ?? (cats ? "Uncategorised" : "…");

  const load = async () => {
    setLoading(true);
    const [r, c] = await Promise.all([poojaAdminApi.poojas.list(), poojaAdminApi.bookings.counts()]);
    if (r.ok) setRows(r.data); else toast(r.message, "error");
    if (c.ok) setCounts(c.data);
    setLoading(false);
  };
  useOnMount(load);

  const by = useMemo(() => ({
    active: rows.filter((p) => p.status === "active").length,
    draft: rows.filter((p) => p.status === "draft").length,
    paused: rows.filter((p) => p.status === "paused").length,
    archived: rows.filter((p) => p.status === "archived").length,
  }), [rows]);
  const shown = tab === "all" ? rows : rows.filter((p) => p.status === tab);

  const setStatus = async (p: PoojaListItem, status: PoojaStatus) => {
    const r = await poojaAdminApi.poojas.setStatus(p.id, status);
    if (!r.ok) return toast(r.message, "error");
    toast(`${p.title}: ${POOJA_STATUS[status].label}`, "success");
    setRows((list) => list.map((x) => (x.id === p.id ? { ...x, ...r.data } : x)));
  };
  const duplicate = async (p: PoojaListItem) => {
    const r = await poojaAdminApi.poojas.duplicate(p.id);
    if (r.ok) router.push(`/admin/poojas/${r.data.id}`); else toast(r.message, "error");
  };
  const remove = async () => {
    if (!askDelete) return;
    const r = await poojaAdminApi.poojas.remove(askDelete.id);
    if (r.ok) { toast("Deleted", "success"); setRows((l) => l.filter((x) => x.id !== askDelete.id)); } else toast(r.message, "error");
  };

  const fromPrice = (p: PoojaListItem) => { const a = p.packages.filter((x) => x.active); return a.length ? Math.min(...a.map((x) => x.price)) : null; };

  const columns: Column<PoojaListItem>[] = [
    {
      key: "title", header: "Pooja", searchable: true, sortable: true, accessor: (p) => `${p.title} ${p.deity} ${p.tags.join(" ")}`,
      cell: (p) => (
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md" style={{ background: "var(--a-surface-2)" }}>{p.coverImage ? <Image src={p.coverImage} alt="" fill sizes="56px" className="object-cover" unoptimized /> : <Flame size={16} className="m-auto mt-3" style={{ color: "var(--a-faint)" }} />}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{p.title}{p.featured && <span className="ml-1.5 text-[10px]" style={{ color: "var(--a-gold)" }}>FEATURED</span>}</p>
            <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>{[p.deity, p.location.place || p.location.city].filter(Boolean).join(" · ") || "/" + p.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "type", header: "Type", sortable: true, filterable: true, filterOptions: ["Pooja", "Havan"],
      accessor: (p) => (p.type === "havan" ? "Havan" : "Pooja"),
      cell: (p) => <StatusPill tone={p.type === "havan" ? "gold" : "muted"}>{p.type === "havan" ? `Havan${p.havan.durationDays > 1 ? ` · ${p.havan.durationDays} days` : ""}` : "Pooja"}</StatusPill>,
    },
    { key: "category", header: "Category", filterable: true, filterOptions: (cats ?? []).map((c) => c.name), accessor: (p) => catName(p.category), cell: (p) => <span className="text-sm" style={{ color: "var(--a-muted)" }}>{catName(p.category)}</span> },
    { key: "packages", header: "Packages", accessor: (p) => p.packages.filter((x) => x.active).length, cell: (p) => <span className="text-xs" style={{ color: "var(--a-muted)" }}>{p.packages.filter((x) => x.active).map((x) => PACKAGE_LABEL[x.kind]).join(", ") || "None"}</span> },
    { key: "price", header: "From", sortable: true, align: "right", accessor: (p) => fromPrice(p) ?? 0, cell: (p) => <span className="font-semibold" style={{ color: "var(--a-fg)" }}>{fromPrice(p) === null ? "–" : inr(fromPrice(p)!)}</span> },
    { key: "upcoming", header: "Upcoming", sortable: true, align: "right", accessor: (p) => p.upcoming },
    { key: "bookings", header: "Bookings", sortable: true, align: "right", accessor: (p) => p.bookings },
    { key: "revenue", header: "Revenue", sortable: true, align: "right", accessor: (p) => p.revenue, cell: (p) => <span className="text-sm">{inr(p.revenue)}</span> },
    { key: "status", header: "Status", sortable: true, filterable: true, filterOptions: Object.keys(POOJA_STATUS), accessor: (p) => p.status, cell: (p) => <StatusPill tone={POOJA_STATUS[p.status].tone}>{POOJA_STATUS[p.status].label}</StatusPill> },
  ];

  return (
    <div>
      <PageHeader title="Poojas & Havan" subtitle="Your pooja and havan / yagya catalog: packages, dates, sankalp form and policies."
        action={<div className="flex gap-2"><AdminButton variant="outline" onClick={() => setManageCats(true)}><Tags size={16} /> Categories{cats ? ` (${cats.length})` : ""}</AdminButton><Link href="/admin/poojas/bookings"><AdminButton variant="outline"><CalendarDays size={16} /> Bookings</AdminButton></Link><Link href="/admin/poojas/new?type=havan"><AdminButton variant="outline"><Plus size={16} /> New havan</AdminButton></Link><Link href="/admin/poojas/new"><AdminButton><Plus size={16} /> New pooja</AdminButton></Link></div>} />
      {loading ? <StatsSkeleton count={4} /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Flame} value={by.active} label={`Live poojas (${rows.length} total)`} tone="gold" />
          <StatCard icon={CalendarDays} value={counts?.today ?? 0} label="Poojas today" tone="royal" />
          <StatCard icon={Users} value={counts?.needsPandit ?? 0} label="Need a pandit" tone="blue" />
          <StatCard icon={IndianRupee} value={inr(rows.reduce((a, p) => a + p.revenue, 0))} label="Revenue (net of refunds)" tone="green" />
        </div>
      )}
      <div className="mt-6">
        <Tabs<TabKey> value={tab} onChange={setTab} tabs={[
          { value: "all", label: "All", count: rows.length }, { value: "active", label: "Live", count: by.active }, { value: "draft", label: "Drafts", count: by.draft },
          { value: "paused", label: "Paused", count: by.paused }, { value: "archived", label: "Archived", count: by.archived },
        ]} />
      </div>
      <div className="mt-4">
        <DataTable
          data={shown}
          columns={columns}
          getRowId={(p) => p.id}
          loading={loading}
          onRefresh={load}
          exportName="poojas"
          searchPlaceholder="Search pooja, deity or tag"
          onRowClick={(p) => router.push(`/admin/poojas/${p.id}`)}
          emptyTitle="No poojas yet"
          emptyMessage="Create your first pooja to start taking bookings."
          rowActions={(p) => (
            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Link href={`/admin/poojas/${p.id}`} aria-label="Edit" className="rounded-md p-1.5 hover:bg-black/[0.05]"><Pencil size={15} /></Link>
              {p.status === "active" ? (
                <button type="button" aria-label="Pause" title="Pause new bookings" onClick={() => setStatus(p, "paused")} className="rounded-md p-1.5 hover:bg-black/[0.05]"><Pause size={15} /></button>
              ) : p.status !== "archived" ? (
                <button type="button" aria-label="Go live" title="Go live" onClick={() => setStatus(p, "active")} className="rounded-md p-1.5 hover:bg-black/[0.05]"><Play size={15} /></button>
              ) : null}
              <button type="button" aria-label="Duplicate" title="Duplicate" onClick={() => duplicate(p)} className="rounded-md p-1.5 hover:bg-black/[0.05]"><Copy size={15} /></button>
              {p.bookings === 0 ? (
                <button type="button" aria-label="Delete" title="Delete" onClick={() => setAskDelete(p)} className="rounded-md p-1.5 text-rose-600 hover:bg-rose-500/10"><Trash2 size={15} /></button>
              ) : p.status !== "archived" ? (
                <button type="button" title="Archive (has bookings)" onClick={() => setStatus(p, "archived")} className="rounded-md px-1.5 py-1 text-xs hover:bg-black/[0.05]" style={{ color: "var(--a-muted)" }}>Archive</button>
              ) : null}
            </div>
          )}
        />
      </div>
      <ConfirmDialog open={!!askDelete} onClose={() => setAskDelete(null)} onConfirm={remove} title={`Delete ${askDelete?.title ?? ""}?`} message="This cannot be undone." confirmLabel="Delete" danger />
      {/* Merges move poojas between categories, so reload the list too. */}
      <CategoryDrawer open={manageCats} onClose={() => setManageCats(false)} onChanged={async () => { await reloadCats(); const r = await poojaAdminApi.poojas.list(); if (r.ok) setRows(r.data); }} />
    </div>
  );
}
