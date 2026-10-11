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
} from "lucide-react";
import type { Product } from "@/types";
import { adminApi } from "@/lib/admin-api";
import { formatPrice } from "@/lib/utils";
import {
  PageHeader,
  AdminButton,
  StatCard,
  StatsSkeleton,
  DataTable,
  StatusPill,
  ActionMenu,
  ConfirmDialog,
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

  const load = async () => {
    setLoading(true);
    const res = await adminApi.products.list();
    if (res.ok) setProducts(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

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

  const duplicate = async (p: Product) => {
    const res = await adminApi.products.create({
      name: `${p.name} (Copy)`,
      category: p.category,
      price: p.price,
      mrp: p.mrp,
      image: p.image,
      images: p.images,
      shortDescription: p.shortDescription,
      badge: p.badge,
      status: "draft",
      stockQty: p.stockQty,
      sku: p.sku ? `${p.sku}-copy` : undefined,
      tags: p.tags,
      zodiac: p.zodiac,
      variants: p.variants,
      attributes: {
        stone: p.attributes.stone,
        planet: p.attributes.planet,
        origin: p.attributes.origin,
        weightCarat: p.attributes.weightCarat,
        certification: p.attributes.certification,
        color: p.attributes.color,
        benefits: p.attributes.benefits,
      },
    });
    if (res.ok) {
      toast("Product duplicated as draft", "success");
      setProducts((prev) => [res.data, ...prev]);
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

  /** run an update across many ids, then refresh */
  const bulkUpdate = async (
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
                onSave={(v) => {
                  const n = Math.max(0, Math.round(Number(v.replace(/[^0-9]/g, ""))));
                  if (!Number.isFinite(n)) return toast("Enter a valid quantity", "error");
                  patchField(p.id, { stockQty: n }, "Stock updated");
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
          <AdminButton onClick={() => router.push("/admin/products/new")}>
            <Plus size={16} /> Add Product
          </AdminButton>
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
                onClick={() => bulkUpdate(ids, { inStock: true }, clear, "marked in stock")}
              >
                <PackageCheck size={15} /> In stock
              </AdminButton>
              <AdminButton
                variant="outline"
                onClick={() => bulkUpdate(ids, { inStock: false, stockQty: 0 }, clear, "marked out of stock")}
              >
                <PackageX size={15} /> Out of stock
              </AdminButton>
              <AdminButton
                variant="outline"
                onClick={() => bulkUpdate(ids, { status: "archived" }, clear, "archived")}
              >
                <Archive size={15} /> Archive
              </AdminButton>
              <AdminButton
                variant="danger"
                onClick={async () => {
                  await Promise.all(ids.map((id) => adminApi.products.remove(id)));
                  toast(`${ids.length} products deleted`, "success");
                  clear();
                  load();
                }}
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
                { label: "Delete", icon: Trash2, danger: true, onClick: () => setToDelete(p) },
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
    </div>
  );
}
