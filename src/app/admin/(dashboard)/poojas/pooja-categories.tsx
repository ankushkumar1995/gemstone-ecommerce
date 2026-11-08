"use client";

/**
 * Pooja categories, managed inside the Pooja section (no separate menu):
 *   • CategoryField   dropdown in the pooja editor + inline "+ New category"
 *                     (keeps the form state) + "Manage categories"
 *   • CategoryDrawer  right-side panel: add, edit, reorder, show/hide,
 *                     delete (only when empty) and merge
 *   • useCategories   shared loader
 * Every rule (unique name/URL, no delete while used) is enforced by the
 * server too; the UI shows the server's message when it says no.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Activity, ArrowDown, ArrowLeft, ArrowUp, Briefcase, Check, Coins, Eye, EyeOff, Flame, Flower2, Gem, GitMerge, GraduationCap, Heart, Leaf, Loader2, Moon,
  Mountain, Pencil, Plus, Settings2, Shield, Sparkles, Star, Sun, Trash2, Users, X, type LucideIcon,
} from "lucide-react";
import { poojaAdminApi } from "@/lib/admin-pooja-api";
import { CATEGORY_ICONS, type CategoryIcon, type PoojaCategoryRow } from "@/modules/poojas/pooja.types";
import { AdminButton, AdminInput, AdminSelectPro, AdminTextarea, ConfirmDialog, Drawer, Field, ImagePickerField, Toggle, useAdminToast } from "../../_components";

export const CATEGORY_ICON_MAP: Record<CategoryIcon, LucideIcon> = {
  Flame, Sparkles, Sun, Moon, Star, Heart, Coins, Briefcase, GraduationCap, Shield, Activity, Users, Leaf, Gem, Flower2, Mountain,
};

export function CategoryBadge({ icon, size = 30 }: { icon: CategoryIcon; size?: number }) {
  const Icon = CATEGORY_ICON_MAP[icon] ?? Flame;
  return (
    <span className="flex shrink-0 items-center justify-center rounded-lg text-white shadow-sm" style={{ width: size, height: size, background: "linear-gradient(135deg, #e6b43a, #b07fff)" }}>
      <Icon size={Math.round(size * 0.5)} />
    </span>
  );
}

/** Loads categories once and exposes reload. */
export function useCategories() {
  const [cats, setCats] = useState<PoojaCategoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const r = await poojaAdminApi.categories.list();
    if (r.ok) { setCats(r.data); setError(null); } else setError(r.message);
  }, []);
  useEffect(() => {
    let alive = true;
    void poojaAdminApi.categories.list().then((r) => {
      if (!alive) return;
      if (r.ok) setCats(r.data); else setError(r.message);
    });
    return () => { alive = false; };
  }, []);
  return { cats, setCats, error, reload };
}

/* ------------------------------------------------------------------ *
 * Editor field
 * ------------------------------------------------------------------ */
export function CategoryField({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const { toast } = useAdminToast();
  const { cats, error, reload } = useCategories();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<CategoryIcon>("Flame");
  const [busy, setBusy] = useState(false);
  const [manage, setManage] = useState(false);

  const current = cats?.find((c) => c.key === value);
  const add = async () => {
    const n = name.trim();
    if (n.length < 2 || busy) return;
    setBusy(true);
    const r = await poojaAdminApi.categories.create({ name: n, icon });
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    await reload();
    onChange(r.data.key);
    setAdding(false); setName(""); setIcon("Flame");
    toast(`Category "${r.data.name}" added`, "success");
  };

  return (
    <Field label="Category" required>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {current && <CategoryBadge icon={current.icon} size={38} />}
          <AdminSelectPro value={value} onChange={(e) => onChange(e.target.value)} disabled={!cats} aria-label="Category">
            {!cats && <option>Loading…</option>}
            {cats && !current && <option value={value}>Choose a category</option>}
            {cats?.map((c) => <option key={c.key} value={c.key}>{c.name}{c.visible ? "" : " (hidden)"}</option>)}
          </AdminSelectPro>
        </div>
        {error && <p className="text-xs text-rose-700">{error} <button type="button" className="underline" onClick={() => void reload()}>Retry</button></p>}
        {current && !current.visible && <p className="text-xs text-amber-700">This category is hidden on the website. The pooja still shows in search and other lists.</p>}

        {adding ? (
          <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--a-gold)", background: "var(--a-gold-soft)" }}>
            <div className="flex gap-2">
              <AdminInput autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="e.g. Navratri special" aria-label="New category name"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } if (e.key === "Escape") setAdding(false); }} />
              <AdminButton onClick={add} disabled={busy || name.trim().length < 2}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Add</AdminButton>
              <AdminButton variant="ghost" aria-label="Cancel" onClick={() => { setAdding(false); setName(""); }}><X size={15} /></AdminButton>
            </div>
            <IconPicker value={icon} onChange={setIcon} compact />
            <p className="text-[11px]" style={{ color: "var(--a-muted)" }}>It is selected for this pooja right away. Add an image, description and SEO later from Manage categories.</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs font-medium">
            <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1" style={{ color: "var(--a-gold)" }}><Plus size={13} /> New category</button>
            <span style={{ color: "var(--a-faint)" }}>·</span>
            <button type="button" onClick={() => setManage(true)} className="flex items-center gap-1" style={{ color: "var(--a-muted)" }}><Settings2 size={13} /> Manage categories</button>
          </div>
        )}
      </div>
      <CategoryDrawer open={manage} onClose={() => setManage(false)} onChanged={reload} onMergedAway={(from, into) => { if (from === value) onChange(into); }} />
    </Field>
  );
}

function IconPicker({ value, onChange, compact }: { value: CategoryIcon; onChange: (v: CategoryIcon) => void; compact?: boolean }) {
  return (
    <div className={`grid gap-1.5 ${compact ? "grid-cols-8" : "grid-cols-8"}`} role="radiogroup" aria-label="Icon">
      {CATEGORY_ICONS.map((ic) => {
        const I = CATEGORY_ICON_MAP[ic];
        const on = value === ic;
        return (
          <button key={ic} type="button" role="radio" aria-checked={on} aria-label={ic} onClick={() => onChange(ic)}
            className="flex aspect-square items-center justify-center rounded-lg border transition-colors"
            style={{ borderColor: on ? "var(--a-gold)" : "var(--a-border)", background: on ? "linear-gradient(135deg, #e6b43a, #b07fff)" : "var(--a-surface)", color: on ? "#fff" : "var(--a-muted)" }}>
            <I size={compact ? 14 : 16} />
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Manage drawer
 * ------------------------------------------------------------------ */
type View = { kind: "list" } | { kind: "edit"; row: PoojaCategoryRow } | { kind: "merge"; row: PoojaCategoryRow };
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);

export function CategoryDrawer({ open, onClose, onChanged, onMergedAway }: { open: boolean; onClose: () => void; onChanged?: () => void; onMergedAway?: (fromKey: string, intoKey: string) => void }) {
  const { toast } = useAdminToast();
  const [cats, setCats] = useState<PoojaCategoryRow[] | null>(null);
  const [view, setView] = useState<View>({ kind: "list" });
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState<PoojaCategoryRow | null>(null);
  const [form, setForm] = useState<{ name: string; slug: string; icon: CategoryIcon; image: string; description: string; seo: { title: string; description: string }; visible: boolean } | null>(null);
  const [mergeInto, setMergeInto] = useState("");

  const load = useCallback(async () => {
    const r = await poojaAdminApi.categories.list();
    if (r.ok) setCats(r.data); else toast(r.message, "error");
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void poojaAdminApi.categories.list().then((r) => { if (alive && r.ok) setCats(r.data); });
    return () => { alive = false; };
  }, [open]);

  const changed = async () => { await load(); onChanged?.(); };
  const close = () => { setView({ kind: "list" }); setForm(null); onClose(); };

  const add = async () => {
    const n = newName.trim();
    if (n.length < 2 || busy) return;
    setBusy(true);
    const r = await poojaAdminApi.categories.create({ name: n });
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    setNewName("");
    toast(`"${r.data.name}" added`, "success");
    await changed();
  };

  const move = async (i: number, d: -1 | 1) => {
    if (!cats) return;
    const next = [...cats];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    const before = cats;
    setCats(next);
    const r = await poojaAdminApi.categories.reorder(next.map((c) => c.key));
    if (!r.ok) { setCats(before); toast(r.message, "error"); await load(); return; }
    setCats(r.data);
    onChanged?.();
  };

  const saveRow = async (row: PoojaCategoryRow, patch: Partial<NonNullable<typeof form>>) => {
    const body = { name: row.name, slug: row.slug, icon: row.icon, image: row.image, description: row.description, seo: row.seo, visible: row.visible, ...patch };
    setBusy(true);
    const r = await poojaAdminApi.categories.update(row.key, body);
    setBusy(false);
    if (!r.ok) { toast(r.message, "error"); return false; }
    await changed();
    return true;
  };

  const openEdit = (row: PoojaCategoryRow) => {
    setForm({ name: row.name, slug: row.slug, icon: row.icon, image: row.image, description: row.description, seo: { ...row.seo }, visible: row.visible });
    setView({ kind: "edit", row });
  };
  const formErr = form && (form.name.trim().length < 2 ? "Name needs at least 2 characters" : !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug) ? "URL can use lowercase letters, numbers and single dashes" : null);

  const remove = async () => {
    if (!askDelete) return;
    const r = await poojaAdminApi.categories.remove(askDelete.key);
    if (!r.ok) return toast(r.message, "error");
    toast(`"${askDelete.name}" deleted`, "success");
    setView({ kind: "list" });
    await changed();
  };
  const merge = async (row: PoojaCategoryRow) => {
    if (!mergeInto) return;
    setBusy(true);
    const r = await poojaAdminApi.categories.merge(row.key, mergeInto);
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    toast(`${r.data.moved} pooja${r.data.moved === 1 ? "" : "s"} moved to "${r.data.into.name}". "${row.name}" deleted.`, "success");
    onMergedAway?.(row.key, mergeInto);
    setView({ kind: "list" }); setMergeInto("");
    await changed();
  };

  const title = view.kind === "list" ? "Pooja categories" : view.kind === "edit" ? `Edit ${view.row.name}` : `Merge ${view.row.name}`;
  const subtitle = view.kind === "list" ? "Add, rename, reorder or hide. Changes show on the website right away." : view.kind === "edit" ? `${view.row.poojaCount} pooja${view.row.poojaCount === 1 ? "" : "s"} in this category` : "Move its poojas into another category, then remove it.";

  return (
    <Drawer open={open} onClose={close} title={title} subtitle={subtitle}
      footer={view.kind === "edit" && form ? (
        <div className="flex gap-2">
          <AdminButton variant="ghost" onClick={() => setView({ kind: "list" })}><ArrowLeft size={15} /> Back</AdminButton>
          <AdminButton className="flex-1" disabled={busy || !!formErr} onClick={async () => { if (await saveRow(view.row, { ...form, name: form.name.trim() })) { toast("Category saved", "success"); setView({ kind: "list" }); } }}>{busy ? "Saving…" : "Save category"}</AdminButton>
        </div>
      ) : undefined}>
      {view.kind === "list" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <AdminInput value={newName} onChange={(e) => setNewName(e.target.value.slice(0, 60))} placeholder="New category name" aria-label="New category name" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }} />
            <AdminButton onClick={add} disabled={busy || newName.trim().length < 2}><Plus size={15} /> Add</AdminButton>
          </div>
          {!cats ? <p className="flex items-center gap-2 text-sm" style={{ color: "var(--a-muted)" }}><Loader2 size={15} className="animate-spin" /> Loading…</p> : (
            <ul className="space-y-2">
              {cats.map((c, i) => (
                <li key={c.key} className="flex items-center gap-2.5 rounded-xl border p-2.5" style={{ borderColor: "var(--a-border)", opacity: c.visible ? 1 : 0.6 }}>
                  <CategoryBadge icon={c.icon} size={34} />
                  <button type="button" onClick={() => openEdit(c)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{c.name}</p>
                    <p className="truncate text-[11px]" style={{ color: "var(--a-faint)" }}>/{c.slug} · {c.poojaCount} pooja{c.poojaCount === 1 ? "" : "s"}{c.visible ? "" : " · hidden"}</p>
                  </button>
                  <div className="flex items-center">
                    <button type="button" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded-md p-1.5 hover:bg-black/[0.05] disabled:opacity-25" style={{ color: "var(--a-muted)" }}><ArrowUp size={14} /></button>
                    <button type="button" aria-label={`Move ${c.name} down`} disabled={i === cats.length - 1} onClick={() => move(i, 1)} className="rounded-md p-1.5 hover:bg-black/[0.05] disabled:opacity-25" style={{ color: "var(--a-muted)" }}><ArrowDown size={14} /></button>
                    <button type="button" aria-label={c.visible ? `Hide ${c.name}` : `Show ${c.name}`} title={c.visible ? "Hide on website" : "Show on website"} onClick={async () => { if (await saveRow(c, { visible: !c.visible })) toast(c.visible ? `"${c.name}" hidden` : `"${c.name}" visible`, "success"); }} className="rounded-md p-1.5 hover:bg-black/[0.05]" style={{ color: "var(--a-muted)" }}>{c.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                    <button type="button" aria-label={`Edit ${c.name}`} onClick={() => openEdit(c)} className="rounded-md p-1.5 hover:bg-black/[0.05]" style={{ color: "var(--a-muted)" }}><Pencil size={14} /></button>
                    {c.poojaCount > 0
                      ? <button type="button" aria-label={`Merge ${c.name}`} title="Move poojas to another category" onClick={() => { setMergeInto(""); setView({ kind: "merge", row: c }); }} className="rounded-md p-1.5 hover:bg-black/[0.05]" style={{ color: "var(--a-muted)" }}><GitMerge size={14} /></button>
                      : <button type="button" aria-label={`Delete ${c.name}`} disabled={cats.length <= 1} onClick={() => setAskDelete(c)} className="rounded-md p-1.5 text-rose-600 hover:bg-rose-500/10 disabled:opacity-25"><Trash2 size={14} /></button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px]" style={{ color: "var(--a-faint)" }}>Categories with poojas cannot be deleted. Use merge (<GitMerge size={10} className="inline" />) to move their poojas first, or hide them.</p>
        </div>
      )}

      {view.kind === "edit" && form && (
        <div className="space-y-4">
          {formErr && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700" role="alert">{formErr}</p>}
          <Field label="Name" required><AdminInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.slice(0, 60) })} /></Field>
          <Field label="Page URL" hint={`/pooja/category/${form.slug || "…"}`}>
            <div className="flex gap-2">
              <AdminInput value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 70) })} />
              <AdminButton variant="ghost" onClick={() => setForm({ ...form, slug: slugify(form.name) })}>From name</AdminButton>
            </div>
          </Field>
          {form.slug !== view.row.slug && view.row.poojaCount > 0 && <p className="text-xs text-amber-700">Changing the URL breaks links to this category that were already shared.</p>}
          <Field label="Icon"><IconPicker value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} /></Field>
          <Field label="Banner image (optional)" hint="Shown at the top of the category page"><ImagePickerField value={form.image} onChange={(u) => setForm({ ...form, image: u })} folder="poojas" /></Field>
          <Field label="Description" hint={`${form.description.length}/300`}><AdminTextarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 300) })} placeholder="Poojas to remove doshas from your kundli…" /></Field>
          <Field label="Search title" hint={`${form.seo.title.length}/70 · empty = name`}><AdminInput value={form.seo.title} onChange={(e) => setForm({ ...form, seo: { ...form.seo, title: e.target.value.slice(0, 70) } })} /></Field>
          <Field label="Search description" hint={`${form.seo.description.length}/170`}><AdminTextarea rows={2} value={form.seo.description} onChange={(e) => setForm({ ...form, seo: { ...form.seo, description: e.target.value.slice(0, 170) } })} /></Field>
          <Toggle checked={form.visible} onChange={(v) => setForm({ ...form, visible: v })} label="Show on the website" />
          <div className="border-t pt-4" style={{ borderColor: "var(--a-border)" }}>
            {view.row.poojaCount > 0
              ? <AdminButton variant="outline" onClick={() => { setMergeInto(""); setView({ kind: "merge", row: view.row }); }}><GitMerge size={15} /> Merge into another category</AdminButton>
              : <AdminButton variant="danger" disabled={(cats?.length ?? 0) <= 1} onClick={() => setAskDelete(view.row)}><Trash2 size={15} /> Delete category</AdminButton>}
          </div>
        </div>
      )}

      {view.kind === "merge" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--a-surface-2)" }}>
            <CategoryBadge icon={view.row.icon} size={34} />
            <p className="text-sm" style={{ color: "var(--a-fg)" }}><b>{view.row.poojaCount}</b> pooja{view.row.poojaCount === 1 ? "" : "s"} in <b>{view.row.name}</b> will move to:</p>
          </div>
          <Field label="Move into">
            <AdminSelectPro value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}>
              <option value="">Choose a category…</option>
              {cats?.filter((c) => c.key !== view.row.key).map((c) => <option key={c.key} value={c.key}>{c.name} ({c.poojaCount})</option>)}
            </AdminSelectPro>
          </Field>
          <p className="text-xs" style={{ color: "var(--a-muted)" }}>&ldquo;{view.row.name}&rdquo; is deleted after the move. Bookings are not affected. This is recorded in the activity log.</p>
          <div className="flex gap-2">
            <AdminButton variant="ghost" onClick={() => setView({ kind: "list" })}><ArrowLeft size={15} /> Back</AdminButton>
            <AdminButton className="flex-1" variant="danger" disabled={busy || !mergeInto} onClick={() => merge(view.row)}>{busy ? "Moving…" : "Move poojas and delete"}</AdminButton>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!askDelete} onClose={() => setAskDelete(null)} onConfirm={remove} title={`Delete "${askDelete?.name ?? ""}"?`} message="It has no poojas, so nothing else changes. This cannot be undone." confirmLabel="Delete" danger />
    </Drawer>
  );
}
