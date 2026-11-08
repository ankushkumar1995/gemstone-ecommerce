"use client";

/**
 * Service categories inside the Services page (no separate menu):
 *   • ServiceCategoryField   select in the service form + inline "+ New"
 *   • ServiceCategoryDrawer  add, edit, reorder, show/hide, delete with a
 *                            choice of where its services move
 */

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, CalendarClock, Check, Eye, EyeOff, Gem, Hash, HeartHandshake, Home, Loader2, Moon, Pencil, PhoneCall, Plus,
  ScrollText, Settings2, Sparkles, Star, Sun, Trash2, TrendingUp, X, type LucideIcon,
} from "lucide-react";
import { serviceCategoryApi } from "@/lib/admin-service-api";
import { SERVICE_ICONS } from "@/modules/services/service.schema";
import type { ServiceCategoryList, ServiceCategoryRow } from "@/modules/services/service-category.types";
import { AdminButton, AdminDropdown, AdminInput, AdminTextarea, ConfirmDialog, Drawer, Field, Toggle, useAdminToast } from "../../_components";

type Icon = (typeof SERVICE_ICONS)[number];
export const SERVICE_ICON_MAP: Record<Icon, LucideIcon> = { ScrollText, Gem, HeartHandshake, TrendingUp, Home, CalendarClock, Hash, PhoneCall, Sparkles, Star, Moon, Sun };

export function CatIcon({ icon, size = 30 }: { icon: string; size?: number }) {
  const I = SERVICE_ICON_MAP[icon as Icon] ?? Sparkles;
  return <span className="flex shrink-0 items-center justify-center rounded-lg text-white shadow-sm" style={{ width: size, height: size, background: "linear-gradient(135deg, #e6b43a, #b07fff)" }}><I size={Math.round(size * 0.5)} /></span>;
}

export function useServiceCategories() {
  const [data, setData] = useState<ServiceCategoryList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const r = await serviceCategoryApi.list();
    if (r.ok) { setData(r.data); setError(null); } else setError(r.message);
  }, []);
  useEffect(() => {
    let alive = true;
    void serviceCategoryApi.list().then((r) => { if (!alive) return; if (r.ok) setData(r.data); else setError(r.message); });
    return () => { alive = false; };
  }, []);
  return { data, error, reload };
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: Icon) => void }) {
  return (
    <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Icon">
      {SERVICE_ICONS.map((ic) => {
        const I = SERVICE_ICON_MAP[ic];
        const on = value === ic;
        return (
          <button key={ic} type="button" role="radio" aria-checked={on} aria-label={ic} onClick={() => onChange(ic)} className="flex aspect-square items-center justify-center rounded-lg border"
            style={{ borderColor: on ? "var(--a-gold)" : "var(--a-border)", background: on ? "linear-gradient(135deg, #e6b43a, #b07fff)" : "var(--a-surface)", color: on ? "#fff" : "var(--a-muted)" }}>
            <I size={15} />
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- field in the service form ---------------- */
export function ServiceCategoryField({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { toast } = useAdminToast();
  const { data, error, reload } = useServiceCategories();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [manage, setManage] = useState(false);
  const cats = data?.categories;
  const current = cats?.find((c) => c.id === value);

  const add = async () => {
    if (name.trim().length < 2 || busy) return;
    setBusy(true);
    const r = await serviceCategoryApi.create({ name: name.trim() });
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    await reload();
    onChange(r.data.id);
    setAdding(false); setName("");
    toast(`Category "${r.data.name}" added`, "success");
  };

  return (
    <Field label="Category" hint="Groups this service on the website">
      <div className="space-y-2">
        <AdminDropdown
          className="w-full"
          value={value ?? ""}
          active={Boolean(current)}
          placeholder={cats ? "Uncategorised" : "Loading…"}
          onChange={(v) => { if (cats) onChange(v || null); }}
          options={[
            { value: "", label: "Uncategorised", meta: data ? `${data.uncategorised}` : undefined },
            ...(value && cats && !current ? [{ value, label: "Removed category (choose another)" }] : []),
            ...(cats ?? []).map((c) => ({
              value: c.id,
              label: `${c.name}${c.visible ? "" : " (hidden)"}`,
              icon: <CatIcon icon={c.icon} size={22} />,
              meta: String(c.serviceCount ?? 0),
            })),
          ]}
        />
        {error && <p className="text-xs text-rose-700">{error} <button type="button" className="underline" onClick={() => void reload()}>Retry</button></p>}
        {adding ? (
          <div className="flex gap-2 rounded-lg border p-2" style={{ borderColor: "var(--a-gold)", background: "var(--a-gold-soft)" }}>
            <AdminInput autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="e.g. Marriage & love" aria-label="New category name"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } if (e.key === "Escape") setAdding(false); }} />
            <AdminButton onClick={add} disabled={busy || name.trim().length < 2}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Add</AdminButton>
            <AdminButton variant="ghost" aria-label="Cancel" onClick={() => { setAdding(false); setName(""); }}><X size={15} /></AdminButton>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs font-medium">
            <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1" style={{ color: "var(--a-gold)" }}><Plus size={13} /> New category</button>
            <span style={{ color: "var(--a-faint)" }}>·</span>
            <button type="button" onClick={() => setManage(true)} className="flex items-center gap-1" style={{ color: "var(--a-muted)" }}><Settings2 size={13} /> Manage categories</button>
          </div>
        )}
      </div>
      <ServiceCategoryDrawer open={manage} onClose={() => setManage(false)} onChanged={reload} onDeleted={(id, moveTo) => { if (id === value) onChange(moveTo); }} />
    </Field>
  );
}

/* ---------------- manage drawer ---------------- */
type View = { kind: "list" } | { kind: "edit"; row: ServiceCategoryRow } | { kind: "delete"; row: ServiceCategoryRow };
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);

export function ServiceCategoryDrawer({ open, onClose, onChanged, onDeleted }: { open: boolean; onClose: () => void; onChanged?: () => void; onDeleted?: (id: string, movedTo: string | null) => void }) {
  const { toast } = useAdminToast();
  const [data, setData] = useState<ServiceCategoryList | null>(null);
  const [view, setView] = useState<View>({ kind: "list" });
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ name: string; slug: string; icon: Icon; description: string; visible: boolean } | null>(null);
  const [moveTo, setMoveTo] = useState<string>("");
  const [askDelete, setAskDelete] = useState<ServiceCategoryRow | null>(null);

  const load = useCallback(async () => {
    const r = await serviceCategoryApi.list();
    if (r.ok) setData(r.data); else toast(r.message, "error");
  }, [toast]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void serviceCategoryApi.list().then((r) => { if (alive && r.ok) setData(r.data); });
    return () => { alive = false; };
  }, [open]);

  const changed = async () => { await load(); onChanged?.(); };
  const close = () => { setView({ kind: "list" }); setForm(null); onClose(); };
  const cats = data?.categories;

  const add = async () => {
    if (newName.trim().length < 2 || busy) return;
    setBusy(true);
    const r = await serviceCategoryApi.create({ name: newName.trim() });
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    setNewName("");
    toast(`"${r.data.name}" added`, "success");
    await changed();
  };
  const move = async (i: number, d: -1 | 1) => {
    if (!cats || !data) return;
    const next = [...cats];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setData({ ...data, categories: next });
    const r = await serviceCategoryApi.reorder(next.map((c) => c.id));
    if (!r.ok) { toast(r.message, "error"); await load(); return; }
    setData(r.data);
    onChanged?.();
  };
  const save = async (row: ServiceCategoryRow, patch: Partial<NonNullable<typeof form>>) => {
    setBusy(true);
    const r = await serviceCategoryApi.update(row.id, { name: row.name, slug: row.slug, icon: row.icon as Icon, description: row.description, visible: row.visible, ...patch });
    setBusy(false);
    if (!r.ok) { toast(r.message, "error"); return false; }
    await changed();
    return true;
  };
  const doDelete = async (row: ServiceCategoryRow, target: string | null | undefined) => {
    setBusy(true);
    const r = await serviceCategoryApi.remove(row.id, target);
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    toast(r.data.moved ? `"${row.name}" deleted. ${r.data.moved} service${r.data.moved > 1 ? "s" : ""} moved.` : `"${row.name}" deleted`, "success");
    onDeleted?.(row.id, target ?? null);
    setView({ kind: "list" }); setMoveTo("");
    await changed();
  };
  const startDelete = (row: ServiceCategoryRow) => {
    if (row.serviceCount > 0) { setMoveTo(""); setView({ kind: "delete", row }); } else setAskDelete(row);
  };
  const formErr = form && (form.name.trim().length < 2 ? "Name needs at least 2 characters" : !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug) ? "URL can use lowercase letters, numbers and single dashes" : null);

  return (
    <Drawer open={open} onClose={close}
      title={view.kind === "list" ? "Service categories" : view.kind === "edit" ? `Edit ${view.row.name}` : `Delete ${view.row.name}`}
      subtitle={view.kind === "list" ? "Group services on the website. Services keep working if you rename a category." : view.kind === "edit" ? `${view.row.serviceCount} service${view.row.serviceCount === 1 ? "" : "s"} in this category` : `${view.row.serviceCount} service${view.row.serviceCount === 1 ? "" : "s"} must move first`}
      footer={view.kind === "edit" && form ? (
        <div className="flex gap-2">
          <AdminButton variant="ghost" onClick={() => setView({ kind: "list" })}><ArrowLeft size={15} /> Back</AdminButton>
          <AdminButton className="flex-1" disabled={busy || !!formErr} onClick={async () => { if (await save(view.row, { ...form, name: form.name.trim() })) { toast("Category saved", "success"); setView({ kind: "list" }); } }}>{busy ? "Saving…" : "Save category"}</AdminButton>
        </div>
      ) : undefined}>
      {view.kind === "list" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <AdminInput value={newName} onChange={(e) => setNewName(e.target.value.slice(0, 60))} placeholder="New category name" aria-label="New category name" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }} />
            <AdminButton onClick={add} disabled={busy || newName.trim().length < 2}><Plus size={15} /> Add</AdminButton>
          </div>
          {!data ? <p className="flex items-center gap-2 text-sm" style={{ color: "var(--a-muted)" }}><Loader2 size={15} className="animate-spin" /> Loading…</p> : (
            <>
              {cats!.length === 0 && <p className="rounded-lg px-3 py-6 text-center text-sm" style={{ background: "var(--a-surface-2)", color: "var(--a-muted)" }}>No categories yet. Add one above, e.g. &ldquo;Kundli &amp; birth chart&rdquo;.</p>}
              <ul className="space-y-2">
                {cats!.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-2.5 rounded-xl border p-2.5" style={{ borderColor: "var(--a-border)", opacity: c.visible ? 1 : 0.6 }}>
                    <CatIcon icon={c.icon} size={34} />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setForm({ name: c.name, slug: c.slug, icon: c.icon as Icon, description: c.description, visible: c.visible }); setView({ kind: "edit", row: c }); }}>
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{c.name}</p>
                      <p className="truncate text-[11px]" style={{ color: "var(--a-faint)" }}>/{c.slug} · {c.serviceCount} service{c.serviceCount === 1 ? "" : "s"}{c.visible ? "" : " · hidden"}</p>
                    </button>
                    <div className="flex items-center">
                      <button type="button" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded-md p-1.5 hover:bg-black/[0.05] disabled:opacity-25" style={{ color: "var(--a-muted)" }}><ArrowUp size={14} /></button>
                      <button type="button" aria-label={`Move ${c.name} down`} disabled={i === cats!.length - 1} onClick={() => move(i, 1)} className="rounded-md p-1.5 hover:bg-black/[0.05] disabled:opacity-25" style={{ color: "var(--a-muted)" }}><ArrowDown size={14} /></button>
                      <button type="button" aria-label={c.visible ? `Hide ${c.name}` : `Show ${c.name}`} onClick={async () => { if (await save(c, { visible: !c.visible })) toast(c.visible ? `"${c.name}" hidden` : `"${c.name}" visible`, "success"); }} className="rounded-md p-1.5 hover:bg-black/[0.05]" style={{ color: "var(--a-muted)" }}>{c.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                      <button type="button" aria-label={`Edit ${c.name}`} onClick={() => { setForm({ name: c.name, slug: c.slug, icon: c.icon as Icon, description: c.description, visible: c.visible }); setView({ kind: "edit", row: c }); }} className="rounded-md p-1.5 hover:bg-black/[0.05]" style={{ color: "var(--a-muted)" }}><Pencil size={14} /></button>
                      <button type="button" aria-label={`Delete ${c.name}`} onClick={() => startDelete(c)} className="rounded-md p-1.5 text-rose-600 hover:bg-rose-500/10"><Trash2 size={14} /></button>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs" style={{ color: "var(--a-muted)" }}>Uncategorised services: <b style={{ color: "var(--a-fg)" }}>{data.uncategorised}</b>. They still show on the website under &ldquo;All&rdquo;.</p>
            </>
          )}
        </div>
      )}

      {view.kind === "edit" && form && (
        <div className="space-y-4">
          {formErr && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700" role="alert">{formErr}</p>}
          <Field label="Name" required><AdminInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.slice(0, 60) })} /></Field>
          <Field label="URL" hint={`/services?category=${form.slug || "…"}`}>
            <div className="flex gap-2">
              <AdminInput value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 70) })} />
              <AdminButton variant="ghost" onClick={() => setForm({ ...form, slug: slugify(form.name) })}>From name</AdminButton>
            </div>
          </Field>
          <Field label="Icon"><IconPicker value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} /></Field>
          <Field label="Description" hint={`${form.description.length}/300`}><AdminTextarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 300) })} /></Field>
          <Toggle checked={form.visible} onChange={(v) => setForm({ ...form, visible: v })} label="Show on the website" />
          <div className="border-t pt-4" style={{ borderColor: "var(--a-border)" }}>
            <AdminButton variant="danger" onClick={() => startDelete(view.row)}><Trash2 size={15} /> Delete category</AdminButton>
          </div>
        </div>
      )}

      {view.kind === "delete" && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--a-fg)" }}>No service is deleted. Choose where the <b>{view.row.serviceCount}</b> service{view.row.serviceCount === 1 ? "" : "s"} in <b>{view.row.name}</b> should go:</p>
          <Field label="Move services to">
            <AdminDropdown
              className="w-full"
              value={moveTo}
              placeholder="Choose…"
              onChange={setMoveTo}
              options={[
                { value: "__none", label: "Uncategorised" },
                ...(cats ?? []).filter((c) => c.id !== view.row.id).map((c) => ({ value: c.id, label: c.name, icon: <CatIcon icon={c.icon} size={22} />, meta: String(c.serviceCount) })),
              ]}
            />
          </Field>
          <div className="flex gap-2">
            <AdminButton variant="ghost" onClick={() => setView({ kind: "list" })}><ArrowLeft size={15} /> Back</AdminButton>
            <AdminButton className="flex-1" variant="danger" disabled={busy || !moveTo} onClick={() => doDelete(view.row, moveTo === "__none" ? null : moveTo)}>{busy ? "Moving…" : "Move services and delete"}</AdminButton>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!askDelete} onClose={() => setAskDelete(null)} onConfirm={() => askDelete && doDelete(askDelete, undefined)} title={`Delete "${askDelete?.name ?? ""}"?`} message="It has no services, so nothing else changes." confirmLabel="Delete" danger />
    </Drawer>
  );
}
