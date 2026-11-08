"use client";

/** Pandits: who performs poojas, which poojas, daily limit, active/inactive, today's load. */

import { useState } from "react";
import { Pencil, Plus, Trash2, UserCheck, Users } from "lucide-react";
import { poojaAdminApi } from "@/lib/admin-pooja-api";
import { panditInputSchema, type PanditInput } from "@/modules/poojas/pooja.schema";
import { istToday } from "@/modules/poojas/pooja.rules";
import type { Pandit, PoojaListItem } from "@/modules/poojas/pooja.types";
import {
  AdminButton, AdminInput, AdminTextarea, Avatar, ConfirmDialog, DataTable, Drawer, Field, ImagePickerField, PageHeader, StatCard, StatsSkeleton, StatusPill, Toggle,
  useAdminToast, useOnMount, type Column,
} from "../../../_components";

const blank = (): PanditInput => ({ name: "", phone: "", email: "", city: "", languages: ["Hindi"], poojaIds: [], experienceYears: 5, photo: "", maxPerDay: 4, active: true, notes: "" });

export function PanditsManager() {
  const { toast } = useAdminToast();
  const [rows, setRows] = useState<Pandit[]>([]);
  const [poojas, setPoojas] = useState<PoojaListItem[]>([]);
  const [load, setLoad] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<{ id: string | null; form: PanditInput } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState<Pandit | null>(null);

  const refresh = async () => {
    setLoading(true);
    const today = istToday(Date.now());
    const [r, p, b] = await Promise.all([poojaAdminApi.pandits.list(), poojaAdminApi.poojas.list(), poojaAdminApi.bookings.list({ from: today, to: today, status: ["assigned", "in_progress", "performed", "completed"] })]);
    if (r.ok) setRows(r.data); else toast(r.message, "error");
    if (p.ok) setPoojas(p.data);
    if (b.ok) { const m: Record<string, number> = {}; b.data.forEach((x) => { if (x.panditId) m[x.panditId] = (m[x.panditId] ?? 0) + 1; }); setLoad(m); }
    setLoading(false);
  };
  useOnMount(refresh);

  const save = async () => {
    if (!edit) return;
    const v = panditInputSchema.safeParse(edit.form);
    if (!v.success) { setErrors(v.error.issues.map((i) => `${i.path.join(".") || "Form"}: ${i.message}`)); return; }
    setErrors([]); setBusy(true);
    const r = edit.id ? await poojaAdminApi.pandits.save(edit.id, v.data) : await poojaAdminApi.pandits.create(v.data);
    setBusy(false);
    if (!r.ok) { setErrors([r.message]); return; }
    toast(edit.id ? "Pandit updated" : "Pandit added", "success");
    setEdit(null);
    await refresh();
  };
  const remove = async () => {
    if (!askDelete) return;
    const r = await poojaAdminApi.pandits.remove(askDelete.id);
    if (r.ok) { toast("Removed", "success"); await refresh(); } else toast(r.message, "error");
  };

  const columns: Column<Pandit>[] = [
    { key: "name", header: "Pandit", searchable: true, sortable: true, accessor: (p) => `${p.name} ${p.phone} ${p.city}`, cell: (p) => <div className="flex items-center gap-2.5"><Avatar name={p.name} src={p.photo || undefined} size={34} /><div><p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{p.name}</p><p className="text-xs" style={{ color: "var(--a-faint)" }}>{p.phone}{p.city ? ` · ${p.city}` : ""}</p></div></div> },
    { key: "poojas", header: "Can perform", accessor: (p) => p.poojaIds.length, cell: (p) => <span className="text-xs" style={{ color: "var(--a-muted)" }}>{p.poojaIds.length === 0 ? "All poojas" : p.poojaIds.map((id) => poojas.find((x) => x.id === id)?.title).filter(Boolean).slice(0, 3).join(", ") + (p.poojaIds.length > 3 ? ` +${p.poojaIds.length - 3}` : "")}</span> },
    { key: "lang", header: "Languages", accessor: (p) => p.languages.join(", "), cell: (p) => <span className="text-xs">{p.languages.join(", ") || "–"}</span> },
    { key: "exp", header: "Exp.", sortable: true, align: "right", accessor: (p) => p.experienceYears, cell: (p) => <span>{p.experienceYears} yr</span> },
    { key: "today", header: "Today", sortable: true, align: "right", accessor: (p) => load[p.id] ?? 0, cell: (p) => <span style={{ color: (load[p.id] ?? 0) >= p.maxPerDay ? "#be123c" : "var(--a-fg)" }}>{load[p.id] ?? 0}/{p.maxPerDay}</span> },
    { key: "status", header: "Status", filterable: true, filterOptions: ["Active", "Inactive"], accessor: (p) => (p.active ? "Active" : "Inactive"), cell: (p) => <StatusPill tone={p.active ? "green" : "muted"}>{p.active ? "Active" : "Inactive"}</StatusPill> },
  ];

  const f = edit?.form;
  const setF = (patch: Partial<PanditInput>) => edit && setEdit({ ...edit, form: { ...edit.form, ...patch } });

  return (
    <div>
      <PageHeader title="Pandits" subtitle="Who performs your poojas, and how many they can take a day." action={<AdminButton onClick={() => { setErrors([]); setEdit({ id: null, form: blank() }); }}><Plus size={16} /> Add pandit</AdminButton>} />
      {loading ? <StatsSkeleton count={3} /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={Users} value={rows.length} label="Pandits" tone="royal" />
          <StatCard icon={UserCheck} value={rows.filter((p) => p.active).length} label="Active" tone="green" />
          <StatCard icon={UserCheck} value={Object.values(load).reduce((a, b) => a + b, 0)} label="Poojas assigned today" tone="gold" />
        </div>
      )}
      <div className="mt-6">
        <DataTable data={rows} columns={columns} getRowId={(p) => p.id} loading={loading} onRefresh={refresh} exportName="pandits" searchPlaceholder="Search name, mobile or city"
          onRowClick={(p) => { setErrors([]); const { id, createdAt: _c, updatedAt: _u, ...rest } = p; void _c; void _u; setEdit({ id, form: rest }); }}
          emptyTitle="No pandits yet" emptyMessage="Add the pandits who perform your poojas."
          rowActions={(p) => (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <button type="button" aria-label="Edit" onClick={() => { setErrors([]); const { id, createdAt: _c, updatedAt: _u, ...rest } = p; void _c; void _u; setEdit({ id, form: rest }); }} className="rounded-md p-1.5 hover:bg-black/[0.05]"><Pencil size={15} /></button>
              <button type="button" aria-label="Remove" onClick={() => setAskDelete(p)} className="rounded-md p-1.5 text-rose-600 hover:bg-rose-500/10"><Trash2 size={15} /></button>
            </div>
          )} />
      </div>

      <Drawer open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit pandit" : "Add pandit"} footer={<AdminButton className="w-full" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</AdminButton>}>
        {f && (
          <div className="space-y-4">
            {errors.length > 0 && <ul className="space-y-0.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
            <Field label="Photo"><ImagePickerField value={f.photo} onChange={(u) => setF({ photo: u })} folder="poojas" aspect="aspect-square" /></Field>
            <Field label="Name" required><AdminInput value={f.name} onChange={(e) => setF({ name: e.target.value.slice(0, 80) })} placeholder="Pt. Ramesh Shastri" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mobile" required><AdminInput inputMode="numeric" value={f.phone} onChange={(e) => setF({ phone: e.target.value.replace(/\D/g, "").slice(-10) })} /></Field>
              <Field label="Email"><AdminInput type="email" value={f.email} onChange={(e) => setF({ email: e.target.value.slice(0, 120) })} /></Field>
              <Field label="City"><AdminInput value={f.city} onChange={(e) => setF({ city: e.target.value.slice(0, 60) })} /></Field>
              <Field label="Experience (years)"><AdminInput type="number" value={Number.isNaN(f.experienceYears) ? "" : f.experienceYears} onChange={(e) => setF({ experienceYears: Math.round(Number(e.target.value)) })} /></Field>
            </div>
            <Field label="Languages" hint="Comma separated"><AdminInput value={f.languages.join(", ")} onChange={(e) => setF({ languages: e.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 10) })} /></Field>
            <Field label="Max poojas a day" hint="Assigning more needs an explicit override"><AdminInput type="number" min={1} value={Number.isNaN(f.maxPerDay) ? "" : f.maxPerDay} onChange={(e) => setF({ maxPerDay: Math.round(Number(e.target.value)) })} /></Field>
            <Field label="Can perform" hint="None selected = all poojas">
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2" style={{ borderColor: "var(--a-border)" }}>
                {poojas.length === 0 && <p className="text-xs" style={{ color: "var(--a-faint)" }}>No poojas yet.</p>}
                {poojas.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm" style={{ color: "var(--a-fg)" }}>
                    <input type="checkbox" checked={f.poojaIds.includes(p.id)} onChange={(e) => setF({ poojaIds: e.target.checked ? [...f.poojaIds, p.id] : f.poojaIds.filter((x) => x !== p.id) })} />{p.title}
                  </label>
                ))}
              </div>
            </Field>
            <Toggle checked={f.active} onChange={(v) => setF({ active: v })} label="Active (can be assigned)" />
            <Field label="Internal notes"><AdminTextarea rows={3} value={f.notes} onChange={(e) => setF({ notes: e.target.value.slice(0, 2000) })} /></Field>
          </div>
        )}
      </Drawer>
      <ConfirmDialog open={!!askDelete} onClose={() => setAskDelete(null)} onConfirm={remove} title={`Remove ${askDelete?.name ?? ""}?`} message="Pandits with upcoming poojas cannot be removed. Reassign them first, or mark the pandit inactive." confirmLabel="Remove" danger />
    </div>
  );
}
