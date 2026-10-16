"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Layers, Star, Pencil, Trash2 } from "lucide-react";
import type { Collection } from "@/types";
import { adminApi } from "@/lib/admin-api";
import { useOnMount } from "../../_components";
import {
  PageHeader,
  AdminButton,
  AdminInput,
  AdminTextarea,
  Card,
  Field,
  Toggle,
  Modal,
  ConfirmDialog,
  Badge,
  StatsSkeleton,
  EmptyState,
  ImagePickerField,
  useAdminToast,
} from "../../_components";

export function CollectionsManager() {
  const { toast } = useAdminToast();
  const [items, setItems] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Collection | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await adminApi.collections.list();
    if (res.ok) setItems(res.data);
    setLoading(false);
  };

  useOnMount(load);

  const openEditor = (c: Collection | null) => {
    setEditing(c);
    setCreating(true);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await adminApi.collections.remove(toDelete.id);
    if (res.ok) {
      toast("Collection deleted", "success");
      setItems((prev) => prev.filter((c) => c.id !== toDelete.id));
    } else toast(res.message, "error");
  };

  return (
    <div>
      <PageHeader
        title="Collections"
        subtitle="Dynamic storefront groupings — curate products beyond fixed categories."
        action={
          <AdminButton onClick={() => openEditor(null)}>
            <Plus size={16} /> New Collection
          </AdminButton>
        }
      />

      {loading ? (
        <StatsSkeleton count={3} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title="No collections yet" message="Create your first collection to group products." />
        </Card>
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {items.map((c) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
              >
                <Card hover className="group overflow-hidden p-0">
                  <div className="relative aspect-[16/9] overflow-hidden" style={{ background: "var(--a-surface-2)" }}>
                    {c.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image} alt={c.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center" style={{ color: "var(--a-faint)" }}>
                        <Layers size={30} />
                      </div>
                    )}
                    {c.featured && (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--a-gold)] px-2 py-0.5 text-[10px] font-bold text-white">
                        <Star size={10} /> Featured
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold" style={{ color: "var(--a-fg)" }}>
                          {c.title}
                        </h3>
                        <Badge tone="muted">/{c.slug}</Badge>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => openEditor(c)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.05]"
                          style={{ color: "var(--a-muted)" }}
                          aria-label="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setToDelete(c)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-500/10"
                          aria-label="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    {c.description && (
                      <p className="mt-2 line-clamp-2 text-sm" style={{ color: "var(--a-muted)" }}>
                        {c.description}
                      </p>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <CollectionEditor
        open={creating}
        editing={editing}
        onClose={() => setCreating(false)}
        onSaved={(c, isNew) => {
          setItems((prev) => (isNew ? [c, ...prev] : prev.map((x) => (x.id === c.id ? c : x))));
          setCreating(false);
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete collection?"
        message={`"${toDelete?.title}" will be removed. Products stay, but lose this grouping.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

function CollectionEditor({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Collection | null;
  onClose: () => void;
  onSaved: (c: Collection, isNew: boolean) => void;
}) {
  const { toast } = useAdminToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [featured, setFeatured] = useState(false);
  const [saving, setSaving] = useState(false);

  // reset fields whenever the editor opens
  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setDescription(editing?.description ?? "");
    setImage(editing?.image ?? "");
    setFeatured(editing?.featured ?? false);
  }, [open, editing]);

  const save = async () => {
    if (!title.trim()) return toast("Title is required", "error");
    setSaving(true);
    const dto = { title, description, image, featured };
    const res = editing
      ? await adminApi.collections.update(editing.id, dto)
      : await adminApi.collections.create(dto);
    setSaving(false);
    if (res.ok) {
      toast(editing ? "Collection updated" : "Collection created", "success");
      onSaved(res.data, !editing);
    } else toast(res.message, "error");
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit collection" : "New collection"}>
      <div className="space-y-4">
        <Field label="Title" required>
          <AdminInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sun Gemstones" />
        </Field>
        <Field label="Description">
          <AdminTextarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What this collection is about…" />
        </Field>
        <Field label="Cover image">
          <ImagePickerField value={image} onChange={setImage} />
        </Field>
        <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Featured</p>
            <p className="text-xs" style={{ color: "var(--a-faint)" }}>Pin to the homepage</p>
          </div>
          <Toggle checked={featured} onChange={setFeatured} />
        </div>
        <div className="flex gap-3 pt-2">
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
