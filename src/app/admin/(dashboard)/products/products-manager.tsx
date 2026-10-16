"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Plus,
  Package,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  Eye,
  Copy,
  AlertTriangle,
  PackageCheck,
  PackageX,
  Archive,
  Star,
  RotateCcw,
  IndianRupee,
} from "lucide-react";
import type { Product } from "@/types";
import { adminApi } from "@/lib/admin-api";
import { useOnMount } from "../../_components";
import { formatPrice } from "@/lib/utils";
import {
  PageHeader,
  AdminButton,
  AdminInput,
  AdminDropdown,
  Field,
  Toggle,
  StatCard,
  StatsSkeleton,
  DataTable,
  StatusPill,
  ActionMenu,
  ConfirmDialog,
  Modal,
  Badge,
  InlineEdit,
  useAdminToast,
  type Column,
} from "../../_components";
import { ProductGridCard } from "./product-grid-card";

/** stock qty at or below this is considered "low" and highlighted */
const LOW_STOCK_THRESHOLD = 3;

export function ProductsManager() {
  const { toast } = useAdminToast();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [deleted, setDeleted] = useState<Product[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);

  // bulk price update modal
  const [priceIds, setPriceIds] = useState<string[] | null>(null);
  const [priceClear, setPriceClear] = useState<(() => void) | null>(null);
  const [priceMode, setPriceMode] = useState<"percent" | "amount" | "set">("percent");
  const [priceValue, setPriceValue] = useState("");
  const [priceApplyMrp, setPriceApplyMrp] = useState(false);
  const [priceRound, setPriceRound] = useState("");
  const [priceSaving, setPriceSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await adminApi.products.list();
    if (res.ok) setProducts(res.data);
    setLoading(false);
  };

  useOnMount(load);

  /** Load the soft-deleted products for the trash view. */
  const loadTrash = async () => {
    setTrashLoading(true);
    const res = await adminApi.products.listDeleted();
    if (res.ok) setDeleted(res.data);
    else toast(res.message, "error");
    setTrashLoading(false);
  };

  const openTrash = () => {
    setShowTrash(true);
    loadTrash();
  };

  /** Restore a soft-deleted product via the dedicated endpoint. */
  const restore = async (p: Product) => {
    const res = await adminApi.products.restore(p.id);
    if (res.ok) {
      toast(`"${p.name}" restored as draft`, "success");
      setDeleted((prev) => prev.filter((x) => x.id !== p.id));
      load();
    } else {
      toast(res.message, "error");
    }
  };

  const stats = useMemo(() => {
    const total = products.length;
    const inStock = products.filter((p) => p.inStock).length;
    const outStock = total - inStock;
    const lowStock = products.filter(
      (p) => (p.stockQty ?? 0) > 0 && (p.stockQty ?? 0) <= LOW_STOCK_THRESHOLD
    ).length;
    const value = products.reduce((s, p) => s + p.price, 0);
    return { total, inStock, outStock, lowStock, value };
  }, [products]);

  /** merge a server-updated product into local state */
  const applyUpdate = (updated: Product) =>
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

  /** patch a single product field inline, optimistic + server-synced */
  const patchField = async (
    id: string,
    dto: Parameters<typeof adminApi.products.update>[1],
    successMsg?: string
  ) => {
    const res = await adminApi.products.update(id, dto);
    if (res.ok) {
      applyUpdate(res.data);
      if (successMsg) toast(successMsg, "success");
    } else {
      toast(res.message, "error");
    }
  };

  /** Duplicate via the dedicated endpoint (clones all fields, zeroes rollups). */
  const duplicate = async (p: Product) => {
    const res = await adminApi.products.duplicate(p.id);
    if (res.ok) {
      toast("Product duplicated as draft", "success");
      setProducts((prev) => [res.data, ...prev]);
    } else {
      toast(res.message, "error");
    }
  };

  /** Change lifecycle status via the dedicated endpoint (logs + audits). */
  const changeStatus = async (p: Product, status: "draft" | "active" | "archived") => {
    const res = await adminApi.products.setStatus(p.id, status);
    if (res.ok) {
      applyUpdate(res.data);
      toast(`Status set to "${status}"`, "success");
    } else {
      toast(res.message, "error");
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await adminApi.products.remove(toDelete.id);
    if (res.ok) {
      toast("Product deleted", "success");
      setProducts((prev) => prev.filter((p) => p.id !== toDelete.id));
    } else {
      toast(res.message, "error");
    }
  };

  /** Stock toggles aren't covered by the bulk endpoint — loop generic update. */
  const bulkStock = async (
    ids: string[],
    dto: Parameters<typeof adminApi.products.update>[1],
    clear: () => void,
    msg: string
  ) => {
    await Promise.all(ids.map((id) => adminApi.products.update(id, dto)));
    toast(`${ids.length} ${msg}`, "success");
    clear();
    load();
  };

  /** Status / feature / delete via the single dedicated bulk endpoint. */
  const bulkAction = async (
    ids: string[],
    action: "status" | "delete" | "feature",
    value: string | boolean | undefined,
    clear: () => void,
    msg: string
  ) => {
    const res = await adminApi.products.bulk(ids, action, value);
    if (res.ok) {
      toast(`${res.data.count} ${msg}`, "success");
      clear();
      load();
    } else {
      toast(res.message, "error");
    }
  };

  /** Open the bulk price modal for the selected ids. */
  const openPriceModal = (ids: string[], clear: () => void) => {
    setPriceIds(ids);
    setPriceClear(() => clear);
    setPriceMode("percent");
    setPriceValue("");
    setPriceApplyMrp(false);
    setPriceRound("");
  };

  const closePriceModal = () => {
    setPriceIds(null);
    setPriceClear(null);
  };

  /** Submit the bulk price change via the dedicated endpoint. */
  const applyBulkPrice = async () => {
    if (!priceIds) return;
    const value = Number(priceValue);
    if (!Number.isFinite(value)) {
      toast("Enter a valid number", "error");
      return;
    }
    setPriceSaving(true);
    const res = await adminApi.products.bulkPrice({
      ids: priceIds,
      mode: priceMode,
      value,
      applyToMrp: priceApplyMrp,
      roundTo: priceRound ? Number(priceRound) : undefined,
    });
    setPriceSaving(false);
    if (res.ok) {
      toast(`Price updated on ${res.data.count} product(s)`, "success");
      priceClear?.();
      closePriceModal();
      load();
    } else {
      toast(res.message, "error");
    }
  };

  /* ---- table columns ---- */
  const columns: Column<Product>[] = [
    {
      key: "name",
      header: "Product",
      searchable: true,
      sortable: true,
      accessor: (p) => p.name,
      cell: (p) => (
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: "var(--a-border)" }}>
            <Image src={p.image} alt={p.name} fill sizes="40px" className="object-cover" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium" style={{ color: "var(--a-fg)" }}>
              {p.name}
            </p>
            <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>
              {p.sku || p.attributes.stone}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      searchable: true,
      filterable: true,
      accessor: (p) => p.category,
      cell: (p) => <Badge tone="royal">{p.category}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      filterOptions: ["active", "review", "draft", "archived"],
      accessor: (p) => p.status ?? "active",
      cell: (p) => {
        const s = p.status ?? "active";
        const tone: "green" | "gold" | "blue" | "muted" =
          s === "active" ? "green" : s === "draft" ? "gold" : s === "review" ? "blue" : "muted";
        return <StatusPill tone={tone}>{s}</StatusPill>;
      },
    },
    {
      key: "price",
      header: "Price",
      sortable: true,
      align: "right",
      accessor: (p) => p.price,
      cell: (p) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <InlineEdit
            value={String(p.price)}
            prefix="₹"
            onSave={(v) => {
              const n = Number(v.replace(/[^0-9.]/g, ""));
              if (!Number.isFinite(n) || n < 0) return toast("Enter a valid price", "error");
              patchField(p.id, { price: n }, "Price updated");
            }}
          />
        </div>
      ),
    },
    {
      key: "stockQty",
      header: "Qty",
      sortable: true,
      align: "right",
      accessor: (p) => p.stockQty ?? 0,
      cell: (p) => {
        const qty = p.stockQty ?? 0;
        const low = qty > 0 && qty <= LOW_STOCK_THRESHOLD;
        return (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            {low && <AlertTriangle size={13} className="text-amber-500" />}
            <span className={low ? "font-semibold text-amber-600" : qty === 0 ? "text-rose-600" : ""}>
              <InlineEdit
                value={String(qty)}
                onSave={async (v) => {
                  const n = Math.max(0, Math.round(Number(v.replace(/[^0-9]/g, ""))));
                  if (!Number.isFinite(n)) return toast("Enter a valid quantity", "error");
                  // Dedicated stock endpoint: keeps stockStatus in sync + audits.
                  const res = await adminApi.products.adjustStock(p.id, { set: n, reason: "Manual edit" });
                  if (res.ok) {
                    applyUpdate(res.data);
                    toast("Stock updated", "success");
                  } else {
                    toast(res.message, "error");
                  }
                }}
              />
            </span>
          </div>
        );
      },
    },
    {
      key: "inStock",
      header: "Stock",
      sortable: true,
      filterable: true,
      filterOptions: ["In stock", "Out"],
      accessor: (p) => (p.inStock ? "In stock" : "Out"),
      cell: (p) =>
        p.inStock ? (
          <StatusPill tone="green">In stock</StatusPill>
        ) : (
          <StatusPill tone="rose">Out</StatusPill>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage your gemstone catalogue."
        action={
          <div className="flex items-center gap-2">
            <AdminButton variant="outline" onClick={openTrash}>
              <Trash2 size={16} /> Trash
            </AdminButton>
            <AdminButton onClick={() => router.push("/admin/products/new")}>
              <Plus size={16} /> Add Product
            </AdminButton>
          </div>
        }
      />

      {/* stats */}
      {loading ? (
        <StatsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Package} value={stats.total} label="Total Products" tone="royal" />
          <StatCard icon={CheckCircle2} value={stats.inStock} label="In Stock" tone="green" />
          <StatCard icon={AlertTriangle} value={stats.lowStock} label={`Low Stock (≤${LOW_STOCK_THRESHOLD})`} tone="gold" />
          <StatCard icon={XCircle} value={stats.outStock} label="Out of Stock" tone="rose" />
        </div>
      )}

      {/* table */}
      <div className="mt-6">
        <DataTable
          data={products}
          columns={columns}
          getRowId={(p) => p.id}
          loading={loading}
          searchPlaceholder="Search products…"
          emptyTitle="No products yet"
          emptyMessage="Add your first gemstone to get started."
          onRefresh={load}
          exportName="products"
          onRowClick={(p) => router.push(`/admin/products/${p.id}`)}
          renderGridItem={(p) => (
            <ProductGridCard
              product={p}
              onEdit={() => router.push(`/admin/products/${p.id}/edit`)}
              onView={() => router.push(`/admin/products/${p.id}`)}
              onDelete={() => setToDelete(p)}
            />
          )}
          bulkActions={(ids, clear) => (
            <div className="flex flex-wrap items-center gap-2">
              <AdminButton
                variant="outline"
                onClick={() => bulkAction(ids, "status", "active", clear, "activated")}
              >
                <CheckCircle2 size={15} /> Activate
              </AdminButton>
              <AdminButton
                variant="outline"
                onClick={() => bulkAction(ids, "feature", true, clear, "featured")}
              >
                <Star size={15} /> Feature
              </AdminButton>
              <AdminButton variant="outline" onClick={() => openPriceModal(ids, clear)}>
                <IndianRupee size={15} /> Price
              </AdminButton>
              <AdminButton
                variant="outline"
                onClick={() => bulkStock(ids, { inStock: true }, clear, "marked in stock")}
              >
                <PackageCheck size={15} /> In stock
              </AdminButton>
              <AdminButton
                variant="outline"
                onClick={() => bulkStock(ids, { inStock: false, stockQty: 0 }, clear, "marked out of stock")}
              >
                <PackageX size={15} /> Out of stock
              </AdminButton>
              <AdminButton
                variant="outline"
                onClick={() => bulkAction(ids, "status", "archived", clear, "archived")}
              >
                <Archive size={15} /> Archive
              </AdminButton>
              <AdminButton
                variant="danger"
                onClick={() => bulkAction(ids, "delete", undefined, clear, "products deleted")}
              >
                <Trash2 size={15} /> Delete
              </AdminButton>
            </div>
          )}
          rowActions={(p) => (
            <ActionMenu
              actions={[
                {
                  label: "View details",
                  icon: Eye,
                  onClick: () => router.push(`/admin/products/${p.id}`),
                },
                {
                  label: "Edit",
                  icon: Pencil,
                  onClick: () => router.push(`/admin/products/${p.id}/edit`),
                },
                {
                  label: "Duplicate",
                  icon: Copy,
                  onClick: () => duplicate(p),
                },
                // lifecycle actions, context-aware for the current status
                ...((p.status ?? "active") !== "active"
                  ? [{ label: "Set active", icon: CheckCircle2, separated: true, onClick: () => changeStatus(p, "active") }]
                  : []),
                ...((p.status ?? "active") !== "draft"
                  ? [{ label: "Move to draft", icon: Pencil, separated: (p.status ?? "active") === "active", onClick: () => changeStatus(p, "draft") }]
                  : []),
                ...((p.status ?? "active") !== "archived"
                  ? [{ label: "Archive", icon: Archive, onClick: () => changeStatus(p, "archived") }]
                  : []),
                { label: "Delete", icon: Trash2, danger: true, separated: true, onClick: () => setToDelete(p) },
              ]}
            />
          )}
        />
      </div>

      {/* delete confirm */}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete product?"
        message={`"${toDelete?.name}" will be permanently removed from your catalogue.`}
        confirmLabel="Delete"
        danger
      />

      {/* trash / restore */}
      <Modal
        open={showTrash}
        onClose={() => setShowTrash(false)}
        title="Deleted products"
        subtitle="Soft-deleted products. Restore brings them back as a draft."
        size="lg"
      >
        {trashLoading ? (
          <p className="py-8 text-center text-sm" style={{ color: "var(--a-muted)" }}>
            Loading…
          </p>
        ) : deleted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Trash2 size={26} style={{ color: "var(--a-faint)" }} />
            <p className="mt-2 text-sm font-medium" style={{ color: "var(--a-fg)" }}>
              Trash is empty
            </p>
            <p className="text-xs" style={{ color: "var(--a-faint)" }}>
              Deleted products will appear here for recovery.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {deleted.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border p-3"
                style={{ borderColor: "var(--a-border)" }}
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: "var(--a-border)" }}>
                  <Image src={p.image} alt={p.name} fill sizes="40px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--a-fg)" }}>
                    {p.name}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>
                    {p.sku || p.category}
                  </p>
                </div>
                <AdminButton variant="outline" onClick={() => restore(p)} className="!px-3 !py-2 text-xs">
                  <RotateCcw size={14} /> Restore
                </AdminButton>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* bulk price update */}
      <Modal
        open={priceIds !== null}
        onClose={closePriceModal}
        title="Bulk price update"
        subtitle={`Change price on ${priceIds?.length ?? 0} selected product(s)`}
      >
        <div className="space-y-4">
          <Field label="Adjustment">
            <AdminDropdown
              value={priceMode}
              options={[
                { value: "percent", label: "Percent change (e.g. -10% off)" },
                { value: "amount", label: "Flat amount (e.g. +500 / -200)" },
                { value: "set", label: "Set exact price for all" },
              ]}
              onChange={(v) => setPriceMode(v as "percent" | "amount" | "set")}
              className="w-full"
            />
          </Field>

          <Field
            label={
              priceMode === "percent"
                ? "Percent (negative = discount)"
                : priceMode === "amount"
                ? "Amount in ₹ (negative = reduce)"
                : "New price (₹)"
            }
            hint={
              priceMode === "percent"
                ? "e.g. -10 for 10% off, 15 for +15%"
                : priceMode === "amount"
                ? "e.g. 500 to add ₹500, -200 to cut ₹200"
                : "Every selected product gets this price"
            }
          >
            <AdminInput
              type="number"
              value={priceValue}
              onChange={(e) => setPriceValue(e.target.value)}
              placeholder={priceMode === "percent" ? "-10" : priceMode === "set" ? "4999" : "500"}
            />
          </Field>

          <Field label="Round to nearest ₹ (optional)" hint="e.g. 10 → nearest ₹10. Blank = nearest ₹1">
            <AdminInput
              type="number"
              min={0}
              value={priceRound}
              onChange={(e) => setPriceRound(e.target.value)}
              placeholder="10"
            />
          </Field>

          <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Also adjust MRP</p>
              <p className="text-xs" style={{ color: "var(--a-faint)" }}>Keep the strike-through MRP in step with price</p>
            </div>
            <Toggle checked={priceApplyMrp} onChange={setPriceApplyMrp} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <AdminButton type="button" variant="outline" onClick={closePriceModal}>
              Cancel
            </AdminButton>
            <AdminButton type="button" onClick={applyBulkPrice} disabled={priceSaving}>
              <IndianRupee size={15} /> {priceSaving ? "Applying…" : "Apply price change"}
            </AdminButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
