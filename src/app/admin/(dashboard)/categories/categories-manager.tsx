"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { Category } from "@/types";
import { adminApi } from "@/lib/admin-api";
import {
  PageHeader,
  AdminButton,
  AdminInput,
  AdminTextarea,
  Card,
  Field,
  Modal,
  ConfirmDialog,
  Badge,
  StatsSkeleton,
  EmptyState,
  ImagePickerField,
  useAdminToast,
} from "../../_components";

export function CategoriesManager() {
  const { toast } = useAdminToast();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await adminApi.categories.list();
    if (res.ok) setItems(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openEditor = (c: Category | null) => {
    setEditing(c);
    setEditorOpen(true);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await adminApi.categories.remove(toDelete.id);
    if (res.ok) {
      toast("Category deleted", "success");
      setItems((prev) => prev.filter((c) => c.id !== toDelete.id));
    } else toast(res.message, "error");
  };

  // swap display order with the neighbour
  const reorder = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const a = items[index];
    const b = items[j];
    const aOrder = a.order ?? index + 1;
    const bOrder = b.order ?? j + 1;
    // optimistic swap
    const next = [...items];
    next[index] = { ...b, order: aOrder };
    next[j] = { ...a, order: bOrder };
    next.sort((x, y) => (x.order ?? 999) - (y.order ?? 999));
    setItems(next);
    await Promise.all([
      adminApi.categories.update(a.id, { order: bOrder }),
      adminApi.categories.update(b.id, { order: aOrder }),
    ]);
  };

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Dynamic product categories — add, rename and reorder your storefront taxonomy."
        action={
          <AdminButton onClick={() => openEditor(null)}>
            <Plus size={16} /> New Category
          </AdminButton>
        }
      />

      {loading ? (
        <StatsSkeleton count={3} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title="No categories yet" message="Create your first product category." />
        </Card>
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {items.map((c, i) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
              >
                <Card hover className="group overflow-hidden p-0">
                  {/* storefront-style preview */}
                  <div className="relative aspect-[16/9] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.image}
                      alt={c.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0" style={{ background: c.tint }} />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <h3 className="text-base font-semibold text-white drop-shadow">{c.title}</h3>
                      <p className="line-clamp-1 text-xs text-white/85">{c.tagline}</p>
                    </div>
                    <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-black/50 px-1.5 text-[11px] font-bold text-white">
                      #{c.order ?? "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 p-3">
                    <Badge tone="muted">/{c.slug}</Badge>
                    <div className="flex gap-1">
                      <IconBtn label="Move up" disabled={i === 0} onClick={() => reorder(i, -1)}>
                        <ArrowUp size={15} />
                      </IconBtn>
                      <IconBtn label="Move down" disabled={i === items.length - 1} onClick={() => reorder(i, 1)}>
                        <ArrowDown size={15} />
                      </IconBtn>
                      <IconBtn label="Edit" onClick={() => openEditor(c)}>
                        <Pencil size={15} />
                      </IconBtn>
                      <button
                        onClick={() => setToDelete(c)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-500/10"
                        aria-label="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <CategoryEditor
        open={editorOpen}
        editing={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={(c, isNew) => {
          setItems((prev) =>
            (isNew ? [...prev, c] : prev.map((x) => (x.id === c.id ? c : x))).sort(
              (a, b) => (a.order ?? 999) - (b.order ?? 999)
            )
          );
          setEditorOpen(false);
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete category?"
        message={`"${toDelete?.title}" will be removed. Products in it keep their slug but the category page disappears.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

function IconBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.05] disabled:opacity-30"
      style={{ color: "var(--a-muted)" }}
    >
      {children}
    </button>
  );
}

function CategoryEditor({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Category | null;
  onClose: () => void;
  onSaved: (c: Category, isNew: boolean) => void;
}) {
  const { toast } = useAdminToast();
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [image, setImage] = useState("");
  const [tint, setTint] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setTagline(editing?.tagline ?? "");
    setImage(editing?.image ?? "");
    setTint(editing?.tint ?? "");
  }, [open, editing]);

  const save = async () => {
    if (!title.trim()) return toast("Title is required", "error");
    setSaving(true);
    const dto = { title, tagline, image, tint };
    const res = editing
      ? await adminApi.categories.update(editing.id, dto)
      : await adminApi.categories.create(dto);
    setSaving(false);
    if (res.ok) {
      toast(editing ? "Category updated" : "Category created", "success");
      onSaved(res.data, !editing);
    } else toast(res.message, "error");
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit category" : "New category"}>
      <div className="space-y-4">
        <Field label="Title" required>
          <AdminInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Gemstone Rings" />
        </Field>
        <Field label="Tagline">
          <AdminTextarea value={tagline} onChange={(e) => setTagline(e.target.value)} rows={2} placeholder="Astrologically energised, hand-set in gold & silver" />
        </Field>
        <Field label="Cover image">
          <ImagePickerField value={image} onChange={setImage} />
        </Field>
        <Field label="Overlay tint (CSS gradient)" hint="Readability overlay on the storefront card">
          <AdminInput value={tint} onChange={(e) => setTint(e.target.value)} placeholder="linear-gradient(135deg, rgba(122,69,245,0.35), rgba(21,15,50,0.1))" />
        </Field>

        {/* live preview with tint on top */}
        {image && tint && (
          <div className="relative aspect-[16/9] overflow-hidden rounded-lg border" style={{ borderColor: "var(--a-border)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: tint }} />
            <div className="absolute inset-x-0 bottom-0 p-3">
              <p className="font-semibold text-white drop-shadow">{title || "Category title"}</p>
              <p className="text-xs text-white/85">{tagline}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <AdminButton variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton className="flex-1" onClick={save} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save" : "Create"}
          </AdminButton>
        </div>
      </div>
    </Modal>
  );
}
