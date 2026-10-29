"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Eye } from "lucide-react";
import type { Category } from "@/types";
import { adminApi } from "@/lib/admin-api";
import {
  PageHeader,
  AdminButton,
  AdminInput,
  AdminTextarea,
  AdminSelect,
  Card,
  Field,
  Modal,
  ConfirmDialog,
  Badge,
  StatsSkeleton,
  ImagePickerField,
  useAdminToast,
  useLoadOnce,
  DataTable,
  type Column,
} from "../../_components";

export function CategoriesManager() {
  const { toast } = useAdminToast();
  const router = useRouter();
  const openDetail = (id: string) => router.push(`/admin/categories/${id}`);
  const [items, setItems] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  // Single fetch on mount, Strict-Mode safe (no duplicate request).
  const { loading } = useLoadOnce(async () => {
    const res = await adminApi.categories.list();
    if (res.ok) setItems(res.data);
  });

  const openEditor = (c: Category | null) => {
    setEditing(c);
    setEditorOpen(true);
  };

  // Deep link: /admin/categories?edit=<id> (e.g. the "Edit" button on the
  // detail page) opens the editor for that category once the list has loaded,
  // then strips the param so a refresh doesn't re-open it.
  const searchParams = useSearchParams();
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || loading) return;
    const target = items.find((c) => c.id === editId);
    if (target) {
      openEditor(target);
      router.replace("/admin/categories");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, items]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await adminApi.categories.remove(toDelete.id);
    if (res.ok) {
      toast("Category deleted", "success");
      setItems((prev) => prev.filter((c) => c.id !== toDelete.id));
    } else toast(res.message, "error");
  };

  // Group into a 2-level tree: top-level parents, each with ordered children.
  const roots = items
    .filter((c) => !c.parentId)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const childrenOf = (parentId: string) =>
    items
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  // Orphans: children whose parent is missing (e.g. legacy data) — still shown.
  const orphans = items.filter(
    (c) => c.parentId && !items.some((p) => p.id === c.parentId),
  );
  // Flatten into tree display order (each parent immediately followed by its
  // children, then any orphans) so the DataTable renders the hierarchy with
  // indentation. `depth` + sibling context ride along on each row.
  type Row = { c: Category; depth: 0 | 1; siblings: Category[]; index: number };
  const rows: Row[] = [];
  roots.forEach((root, ri) => {
    rows.push({ c: root, depth: 0, siblings: roots, index: ri });
    childrenOf(root.id).forEach((kid, ki) =>
      rows.push({ c: kid, depth: 1, siblings: childrenOf(root.id), index: ki }),
    );
  });
  orphans.forEach((o, oi) =>
    rows.push({ c: o, depth: 1, siblings: orphans, index: oi }),
  );

  // Swap display order with the neighbour WITHIN the same sibling list (same
  // parent). `siblings` is the ordered list the row belongs to.
  const reorder = async (siblings: Category[], index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= siblings.length) return;
    const a = siblings[index];
    const b = siblings[j];
    const aOrder = a.order ?? index + 1;
    const bOrder = b.order ?? j + 1;
    // optimistic swap in the flat items list
    setItems((prev) =>
      prev.map((c) =>
        c.id === a.id ? { ...c, order: bOrder } : c.id === b.id ? { ...c, order: aOrder } : c,
      ),
    );
    await Promise.all([
      adminApi.categories.update(a.id, { order: bOrder }),
      adminApi.categories.update(b.id, { order: aOrder }),
    ]);
  };

  // ---- DataTable columns (shared by table + grid views) --------------------
  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Category",
      searchable: true,
      sortable: true,
      accessor: (r) => r.c.title,
      cell: (r) => (
        <div className="flex items-center gap-3" style={{ paddingLeft: r.depth * 22 }}>
          {r.depth === 1 && <span style={{ color: "var(--a-muted)" }}>↳</span>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={r.c.image}
            alt={r.c.title}
            className="h-10 w-14 flex-shrink-0 rounded-md object-cover"
          />
          <div className="min-w-0">
            <p className="truncate font-medium" style={{ color: "var(--a-fg)" }}>
              {r.c.title}
            </p>
            <p className="truncate text-xs" style={{ color: "var(--a-muted)" }}>
              {r.c.tagline}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "level",
      header: "Level",
      filterable: true,
      accessor: (r) => (r.depth === 0 ? "Top level" : "Sub-category"),
      cell: (r) =>
        r.depth === 0 ? (
          <Badge tone="royal">Top level</Badge>
        ) : (
          <Badge tone="muted">Sub-category</Badge>
        ),
    },
    {
      key: "slug",
      header: "Slug",
      searchable: true,
      accessor: (r) => r.c.slug,
      cell: (r) => <span style={{ color: "var(--a-muted)" }}>/{r.c.slug}</span>,
    },
    {
      key: "order",
      header: "Order",
      align: "center",
      sortable: true,
      accessor: (r) => r.c.order ?? 999,
      cell: (r) => <span style={{ color: "var(--a-muted)" }}>#{r.c.order ?? "—"}</span>,
    },
  ];

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
      ) : (
        <DataTable<Row>
          data={rows}
          columns={columns}
          getRowId={(r) => r.c.id}
          searchPlaceholder="Search categories…"
          emptyTitle="No categories yet"
          emptyMessage="Create your first product category."
          exportName="categories"
          pageSize={10}
          onRowClick={(r) => openDetail(r.c.id)}
          rowActions={(r) => {
            const { siblings, index } = r;
            return (
              <div className="flex items-center justify-end gap-1">
                <IconBtn
                  label="Move up"
                  disabled={index === 0}
                  onClick={() => reorder(siblings, index, -1)}
                >
                  <ArrowUp size={15} />
                </IconBtn>
                <IconBtn
                  label="Move down"
                  disabled={index === siblings.length - 1}
                  onClick={() => reorder(siblings, index, 1)}
                >
                  <ArrowDown size={15} />
                </IconBtn>
                <IconBtn label="View details" onClick={() => openDetail(r.c.id)}>
                  <Eye size={15} />
                </IconBtn>
                <IconBtn label="Edit" onClick={() => openEditor(r.c)}>
                  <Pencil size={15} />
                </IconBtn>
                <button
                  onClick={() => setToDelete(r.c)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-500/10"
                  aria-label="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          }}
          renderGridItem={(r) => (
            <CategoryCard
              c={r.c}
              isParent={r.depth === 0 && childrenOf(r.c.id).length > 0}
              onView={() => openDetail(r.c.id)}
              onEdit={() => openEditor(r.c)}
              onDelete={() => setToDelete(r.c)}
              onUp={() => reorder(r.siblings, r.index, -1)}
              onDown={() => reorder(r.siblings, r.index, 1)}
              upDisabled={r.index === 0}
              downDisabled={r.index === r.siblings.length - 1}
            />
          )}
        />
      )}

      <CategoryEditor
        open={editorOpen}
        editing={editing}
        allCategories={items}
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

function CategoryCard({
  c,
  isParent,
  onView,
  onEdit,
  onDelete,
  onUp,
  onDown,
  upDisabled,
  downDisabled,
}: {
  c: Category;
  isParent?: boolean;
  onView?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUp: () => void;
  onDown: () => void;
  upDisabled: boolean;
  downDisabled: boolean;
}) {
  return (
    <Card hover className="group overflow-hidden p-0">
      {/* storefront-style preview — same compact size for every card.
          Clicking the image opens the rich detail page. */}
      <button
        type="button"
        onClick={onView}
        aria-label={`View ${c.title} details`}
        className="relative block aspect-[16/9] w-full overflow-hidden text-left"
      >
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
        {isParent && (
          <span className="absolute left-2 top-2 rounded-full bg-[var(--a-gold)]/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
            Top level
          </span>
        )}
        <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-black/50 px-1.5 text-[11px] font-bold text-white">
          #{c.order ?? "—"}
        </span>
        {/* hover reveal: View details */}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 backdrop-blur-[1px] transition-opacity duration-300 group-hover:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-black">
            <Eye size={13} /> View details
          </span>
        </span>
      </button>

      <div className="flex items-center justify-between gap-2 p-3">
        <span
          title={`/${c.slug}`}
          className="min-w-0 max-w-[40%] flex-shrink truncate rounded-md bg-black/[0.06] px-2 py-0.5 text-xs font-medium"
          style={{ color: "var(--a-muted)" }}
        >
          /{c.slug}
        </span>
        <div className="flex flex-shrink-0 gap-1">
          <IconBtn label="Move up" disabled={upDisabled} onClick={onUp}>
            <ArrowUp size={15} />
          </IconBtn>
          <IconBtn label="Move down" disabled={downDisabled} onClick={onDown}>
            <ArrowDown size={15} />
          </IconBtn>
          <IconBtn label="View details" onClick={onView ?? (() => {})}>
            <Eye size={15} />
          </IconBtn>
          <IconBtn label="Edit" onClick={onEdit}>
            <Pencil size={15} />
          </IconBtn>
          <button
            onClick={onDelete}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-500/10"
            aria-label="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </Card>
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
  allCategories,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Category | null;
  allCategories: Category[];
  onClose: () => void;
  onSaved: (c: Category, isNew: boolean) => void;
}) {
  const { toast } = useAdminToast();
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [image, setImage] = useState("");
  const [tint, setTint] = useState("");
  const [parentId, setParentId] = useState<string>(""); // "" = top-level
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setTagline(editing?.tagline ?? "");
    setImage(editing?.image ?? "");
    setTint(editing?.tint ?? "");
    setParentId(editing?.parentId ?? "");
  }, [open, editing]);

  // Does the category being edited already have children? If so it must stay
  // top-level (2-level rule) — the parent picker is disabled for it.
  const editingHasChildren = Boolean(
    editing && allCategories.some((c) => c.parentId === editing.id),
  );

  // Valid parent options: active, top-level categories, excluding self.
  const parentOptions = allCategories
    .filter(
      (c) =>
        !c.parentId && // only top-level can be a parent
        c.id !== editing?.id && // can't parent yourself
        (c.status ?? "active") === "active",
    )
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  const save = async () => {
    if (!title.trim()) return toast("Title is required", "error");
    setSaving(true);
    // Send parentId as null for top-level so the backend clears any old parent.
    const dto = { title, tagline, image, tint, parentId: parentId || null };
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
        <Field
          label="Parent category"
          hint={
            editingHasChildren
              ? "This category has sub-categories, so it must stay top-level."
              : "Leave as “None” for a top-level category. Only 2 levels are allowed."
          }
        >
          <AdminSelect
            value={parentId}
            disabled={editingHasChildren}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">None (top-level)</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </AdminSelect>
        </Field>
        <Field label="Tagline">
          <AdminTextarea value={tagline} onChange={(e) => setTagline(e.target.value)} rows={2} placeholder="Astrologically energised, hand-set in gold & silver" />
        </Field>
        <Field label="Cover image">
          <ImagePickerField value={image} onChange={setImage} folder="categories" />
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
