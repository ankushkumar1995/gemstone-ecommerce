"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Boxes,
  AlertTriangle,
  XCircle,
  IndianRupee,
  Check,
  History,
  PackagePlus,
} from "lucide-react";
import type { Product } from "@/types";
import { adminApi } from "@/lib/admin-api";
import { formatPrice } from "@/lib/utils";
import {
  PageHeader,
  StatCard,
  StatsSkeleton,
  DataTable,
  StatusPill,
  AdminButton,
  AdminInput,
  Drawer,
  Timeline,
  SegmentedControl,
  useAdminToast,
  type Column,
} from "../../_components";

type StockFilter = "all" | "low" | "out";

export function InventoryManager() {
  const { toast } = useAdminToast();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [LOW, setLow] = useState(3); // low-stock threshold, from settings
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StockFilter>("all");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [historyOf, setHistoryOf] = useState<Product | null>(null);

  const load = async () => {
    setLoading(true);
    const [res, settingsRes] = await Promise.all([
      adminApi.products.list(),
      adminApi.settings.get(),
    ]);
    if (res.ok) setProducts(res.data);
    if (settingsRes.ok) setLow(settingsRes.data.inventory.lowStockThreshold);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const units = products.reduce((s, p) => s + (p.stockQty ?? 0), 0);
    const low = products.filter((p) => (p.stockQty ?? 0) > 0 && (p.stockQty ?? 0) <= LOW).length;
    const out = products.filter((p) => (p.stockQty ?? 0) === 0).length;
    const value = products.reduce((s, p) => s + (p.stockQty ?? 0) * p.price, 0);
    return { units, low, out, value };
  }, [products, LOW]);

  const filtered = useMemo(() => {
    if (filter === "low") return products.filter((p) => (p.stockQty ?? 0) > 0 && (p.stockQty ?? 0) <= LOW);
    if (filter === "out") return products.filter((p) => (p.stockQty ?? 0) === 0);
    return products;
  }, [products, filter, LOW]);

  const dirty = Object.keys(edits).filter((id) => {
    const p = products.find((x) => x.id === id);
    return p && edits[id] !== "" && Number(edits[id]) !== (p.stockQty ?? 0);
  });

  const saveAll = async () => {
    if (dirty.length === 0) return;
    setSaving(true);
    await Promise.all(
      dirty.map((id) => adminApi.products.update(id, { stockQty: Math.max(0, Math.round(Number(edits[id]))) }))
    );
    setSaving(false);
    toast(`${dirty.length} products restocked`, "success");
    setEdits({});
    load();
  };

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
            <p className="truncate font-medium" style={{ color: "var(--a-fg)" }}>{p.name}</p>
            <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>{p.sku || p.category}</p>
          </div>
        </div>
      ),
    },
    {
      key: "current",
      header: "In stock",
      sortable: true,
      align: "right",
      accessor: (p) => p.stockQty ?? 0,
      cell: (p) => {
        const qty = p.stockQty ?? 0;
        return qty === 0 ? (
          <StatusPill tone="rose">Out</StatusPill>
        ) : qty <= LOW ? (
          <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
            <AlertTriangle size={13} /> {qty}
          </span>
        ) : (
          <span style={{ color: "var(--a-fg)" }}>{qty}</span>
        );
      },
    },
    {
      key: "set",
      header: "Set stock",
      align: "right",
      cell: (p) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <AdminInput
            type="number"
            min={0}
            value={edits[p.id] ?? ""}
            placeholder={String(p.stockQty ?? 0)}
            onChange={(e) => setEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
            className="w-20 text-right"
          />
        </div>
      ),
    },
    {
      key: "value",
      header: "Stock value",
      sortable: true,
      align: "right",
      accessor: (p) => (p.stockQty ?? 0) * p.price,
      cell: (p) => (
        <span style={{ color: "var(--a-muted)" }}>{formatPrice((p.stockQty ?? 0) * p.price)}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Monitor stock levels, spot low/out-of-stock items and restock in bulk."
        action={
          <AdminButton onClick={saveAll} disabled={saving || dirty.length === 0}>
            <Check size={16} /> {saving ? "Saving…" : dirty.length ? `Save ${dirty.length} change${dirty.length > 1 ? "s" : ""}` : "No changes"}
          </AdminButton>
        }
      />

      {loading ? (
        <StatsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Boxes} value={stats.units} label="Total Units" tone="royal" />
          <StatCard icon={AlertTriangle} value={stats.low} label={`Low Stock (≤${LOW})`} tone="gold" />
          <StatCard icon={XCircle} value={stats.out} label="Out of Stock" tone="rose" />
          <StatCard icon={IndianRupee} value={formatPrice(stats.value)} label="Inventory Value" tone="green" />
        </div>
      )}

      <div className="mt-6 mb-3">
        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as StockFilter)}
          options={[
            { value: "all", label: "All" },
            { value: "low", label: `Low (${stats.low})` },
            { value: "out", label: `Out (${stats.out})` },
          ]}
        />
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(p) => p.id}
        loading={loading}
        searchPlaceholder="Search inventory…"
        emptyTitle="Nothing here"
        emptyMessage="No products match this filter."
        onRefresh={load}
        exportName="inventory"
        rowActions={(p) => (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setHistoryOf(p)}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.06]"
              style={{ color: "var(--a-muted)" }}
              aria-label="Stock history"
              title="Stock history"
            >
              <History size={16} />
            </button>
            <button
              onClick={() => router.push(`/admin/products/${p.id}/edit`)}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.06]"
              style={{ color: "var(--a-muted)" }}
              aria-label="Edit product"
              title="Edit product"
            >
              <PackagePlus size={16} />
            </button>
          </div>
        )}
      />

      {/* stock history drawer */}
      <Drawer
        open={!!historyOf}
        onClose={() => setHistoryOf(null)}
        title={historyOf?.name ?? "Stock history"}
        subtitle="Recent stock & activity for this product"
      >
        {historyOf && (
          <div>
            <div className="mb-5 flex items-center gap-4 rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
              <div className="relative h-12 w-12 overflow-hidden rounded-lg border" style={{ borderColor: "var(--a-border)" }}>
                <Image src={historyOf.image} alt="" fill sizes="48px" className="object-cover" />
              </div>
              <div>
                <p className="font-medium" style={{ color: "var(--a-fg)" }}>Current stock</p>
                <p className="text-2xl font-bold" style={{ color: "var(--a-fg)" }}>{historyOf.stockQty ?? 0}</p>
              </div>
            </div>
            {historyOf.activity && historyOf.activity.length > 0 ? (
              <Timeline
                items={historyOf.activity.slice(0, 20).map((a) => ({
                  title: a.message,
                  time: `${new Date(a.at).toLocaleString()}${a.actor ? ` · ${a.actor}` : ""}`,
                  done: a.type === "stock" || a.type === "created",
                }))}
              />
            ) : (
              <p className="text-sm" style={{ color: "var(--a-faint)" }}>No history yet.</p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
