"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Pencil,
  Package,
  Layers,
  FolderTree,
  Hash,
  ArrowUpRight,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";
import type { Category, Product } from "@/types";
import { adminApi } from "@/lib/admin-api";
import { formatPrice } from "@/lib/utils";
import {
  Card,
  AdminButton,
  Badge,
  KeyValueList,
  AdminBreadcrumb,
  TableSkeleton,
  EmptyState,
} from "@/app/admin/_components";

/* ------------------------------------------------------------------ *
 * Motion presets — a soft, staggered entrance used across the page.
 * ------------------------------------------------------------------ */
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CategoryDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [category, setCategory] = useState<Category | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    let active = true;
    (async () => {
      const [catRes, listRes, prodRes] = await Promise.all([
        adminApi.categories.get(id),
        adminApi.categories.list(),
        adminApi.products.list(),
      ]);
      if (!active) return;
      if (!catRes.ok) {
        setState("missing");
        return;
      }
      setCategory(catRes.data);
      setAllCategories(listRes.ok ? listRes.data : []);
      setProducts(prodRes.ok ? prodRes.data : []);
      setState("ok");
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (state === "loading") return <TableSkeleton rows={6} cols={2} />;
  if (state === "missing" || !category)
    return (
      <EmptyState
        title="Category not found"
        message="This category may have been deleted."
      />
    );

  const c = category;
  const isTopLevel = !c.parentId;
  const parent = c.parentId
    ? allCategories.find((x) => x.id === c.parentId) ?? null
    : null;
  const children = allCategories
    .filter((x) => x.parentId === c.id)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  // Slugs that belong to this category's subtree (itself + its children).
  const subtreeSlugs = new Set<string>([c.slug, ...children.map((x) => x.slug)]);
  const directProducts = products.filter((p) => p.category === c.slug);
  const subtreeProducts = products.filter((p) => subtreeSlugs.has(p.category));

  const stats = [
    {
      icon: Package,
      label: isTopLevel ? "Products (incl. sub-cats)" : "Products",
      value: isTopLevel ? subtreeProducts.length : directProducts.length,
      tint: "linear-gradient(135deg, rgba(122,69,245,0.9), rgba(122,69,245,0.5))",
    },
    {
      icon: Layers,
      label: "Level",
      value: isTopLevel ? "Top level" : "Sub-category",
      tint: "linear-gradient(135deg, rgba(230,180,58,0.95), rgba(201,148,42,0.6))",
    },
    {
      icon: FolderTree,
      label: "Sub-categories",
      value: children.length,
      tint: "linear-gradient(135deg, rgba(34,211,238,0.9), rgba(14,165,180,0.55))",
    },
    {
      icon: Hash,
      label: "Display order",
      value: `#${c.order ?? "—"}`,
      tint: "linear-gradient(135deg, rgba(255,107,166,0.9), rgba(219,60,120,0.55))",
    },
  ];

  const previewProducts = (isTopLevel ? subtreeProducts : directProducts).slice(0, 8);

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      {/* breadcrumb */}
      <motion.div variants={item}>
        <AdminBreadcrumb
          items={[
            { label: "Categories", href: "/admin/categories" },
            ...(parent
              ? [{ label: parent.title, href: `/admin/categories/${parent.id}` }]
              : []),
            { label: c.title },
          ]}
        />
      </motion.div>

      {/* ---------------- HERO BANNER ---------------- */}
      <motion.div
        variants={item}
        className="group relative mt-3 overflow-hidden rounded-3xl border"
        style={{ borderColor: "var(--a-border)" }}
      >
        <div className="relative h-56 w-full overflow-hidden sm:h-64">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={c.image}
            alt={c.title}
            className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0" style={{ background: c.tint }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* back button */}
          <button
            onClick={() => router.push("/admin/categories")}
            aria-label="Back to categories"
            className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-black/50"
          >
            <ArrowLeft size={18} />
          </button>

          {/* status + level pills */}
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/30 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
              {(c.status ?? "active") === "active" ? (
                <>
                  <Eye size={13} /> Active
                </>
              ) : (
                <>
                  <EyeOff size={13} /> Inactive
                </>
              )}
            </span>
            <span className="rounded-full border border-white/25 bg-black/30 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
              {isTopLevel ? "Top level" : "Sub-category"}
            </span>
          </div>

          {/* title block */}
          <div className="absolute inset-x-0 bottom-0 p-6">
            {parent && (
              <button
                onClick={() => router.push(`/admin/categories/${parent.id}`)}
                className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-white/70 transition-colors hover:text-white"
              >
                {parent.title}
                <ArrowUpRight size={12} />
              </button>
            )}
            <h1 className="font-display text-3xl font-semibold text-white drop-shadow sm:text-4xl">
              {c.title}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/80">{c.tagline}</p>
            <span className="mt-2 inline-block rounded-md bg-white/15 px-2 py-0.5 text-xs text-white/90 backdrop-blur-sm">
              /{c.slug}
            </span>
          </div>
        </div>

        {/* action row */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 p-4"
          style={{ background: "var(--a-surface)" }}
        >
          <p className="text-sm" style={{ color: "var(--a-muted)" }}>
            {isTopLevel
              ? `${children.length} sub-${children.length === 1 ? "category" : "categories"} · ${subtreeProducts.length} products in this group`
              : `${directProducts.length} products in this category`}
          </p>
          <div className="flex gap-2">
            <AdminButton
              variant="outline"
              onClick={() => window.open(`/shop?category=${c.slug}`, "_blank")}
            >
              <ExternalLink size={15} /> View on store
            </AdminButton>
            <AdminButton onClick={() => router.push(`/admin/categories?edit=${c.id}`)}>
              <Pencil size={15} /> Edit
            </AdminButton>
          </div>
        </div>
      </motion.div>

      {/* ---------------- STAT CARDS ---------------- */}
      <motion.div
        variants={item}
        className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {stats.map((s) => (
          <motion.div
            key={s.label}
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Card className="relative overflow-hidden p-4">
              <span
                className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
                style={{ background: s.tint }}
              >
                <s.icon size={20} />
              </span>
              <p className="text-2xl font-semibold" style={{ color: "var(--a-fg)" }}>
                {s.value}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--a-muted)" }}>
                {s.label}
              </p>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ---------------- MAIN COLUMN ---------------- */}
        <div className="space-y-5 lg:col-span-2">
          {/* sub-categories (if parent) */}
          {isTopLevel && children.length > 0 && (
            <motion.div variants={item}>
              <Card className="p-5">
                <h2
                  className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide"
                  style={{ color: "var(--a-muted)" }}
                >
                  <FolderTree size={15} /> Sub-categories
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {children.map((child) => {
                    const count = products.filter((p) => p.category === child.slug).length;
                    return (
                      <motion.button
                        key={child.id}
                        whileHover={{ y: -3 }}
                        transition={{ type: "spring", stiffness: 300, damping: 22 }}
                        onClick={() => router.push(`/admin/categories/${child.id}`)}
                        className="group flex items-center gap-3 overflow-hidden rounded-xl border p-2 text-left transition-colors hover:border-[var(--a-gold)]"
                        style={{ borderColor: "var(--a-border)" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={child.image}
                          alt={child.title}
                          className="h-14 w-16 flex-shrink-0 rounded-lg object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium" style={{ color: "var(--a-fg)" }}>
                            {child.title}
                          </p>
                          <p className="text-xs" style={{ color: "var(--a-muted)" }}>
                            {count} {count === 1 ? "product" : "products"}
                          </p>
                        </div>
                        <ArrowUpRight
                          size={16}
                          className="flex-shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                          style={{ color: "var(--a-gold)" }}
                        />
                      </motion.button>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          )}

          {/* products preview */}
          <motion.div variants={item}>
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2
                  className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide"
                  style={{ color: "var(--a-muted)" }}
                >
                  <Package size={15} /> Products
                </h2>
                {previewProducts.length > 0 && (
                  <button
                    onClick={() => router.push(`/admin/products`)}
                    className="text-xs font-medium transition-colors hover:underline"
                    style={{ color: "var(--a-gold)" }}
                  >
                    Manage products
                  </button>
                )}
              </div>

              {previewProducts.length === 0 ? (
                <div
                  className="rounded-xl border border-dashed p-8 text-center text-sm"
                  style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}
                >
                  No products in this category yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {previewProducts.map((p) => (
                    <motion.div
                      key={p.id}
                      whileHover={{ y: -4 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="group overflow-hidden rounded-xl border"
                      style={{ borderColor: "var(--a-border)" }}
                    >
                      <div className="relative aspect-square overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.image}
                          alt={p.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      </div>
                      <div className="p-2">
                        <p className="truncate text-xs font-medium" style={{ color: "var(--a-fg)" }}>
                          {p.name}
                        </p>
                        <p className="text-xs" style={{ color: "var(--a-gold)" }}>
                          {formatPrice(p.price)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        {/* ---------------- SIDE COLUMN ---------------- */}
        <div className="space-y-5">
          <motion.div variants={item}>
            <Card className="p-5">
              <h2
                className="mb-4 text-sm font-semibold uppercase tracking-wide"
                style={{ color: "var(--a-muted)" }}
              >
                Details
              </h2>
              <KeyValueList
                items={[
                  { label: "Title", value: c.title },
                  { label: "Slug", value: `/${c.slug}` },
                  {
                    label: "Level",
                    value: isTopLevel ? "Top level" : "Sub-category",
                  },
                  { label: "Parent", value: parent ? parent.title : "—" },
                  {
                    label: "Status",
                    value: (
                      <Badge tone={(c.status ?? "active") === "active" ? "green" : "muted"}>
                        {(c.status ?? "active") === "active" ? "Active" : "Inactive"}
                      </Badge>
                    ),
                  },
                  { label: "Display order", value: `#${c.order ?? "—"}` },
                  { label: "Created", value: fmtDate(c.createdAt) },
                  { label: "Updated", value: fmtDate(c.updatedAt) },
                ]}
              />
            </Card>
          </motion.div>

          {/* overlay preview */}
          <motion.div variants={item}>
            <Card className="p-5">
              <h2
                className="mb-4 text-sm font-semibold uppercase tracking-wide"
                style={{ color: "var(--a-muted)" }}
              >
                Storefront preview
              </h2>
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.image} alt={c.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0" style={{ background: c.tint }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="font-semibold text-white drop-shadow">{c.title}</p>
                  <p className="text-xs text-white/80">{c.tagline}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
