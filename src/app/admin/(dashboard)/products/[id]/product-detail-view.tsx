"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Pencil,
  Eye,
  Star,
  TrendingUp,
  Boxes,
  Copy,
  Check,
  CalendarClock,
  FileText,
  Video,
  Rotate3d,
  Layers,
} from "lucide-react";
import type { Product, Collection } from "@/types";
import type { ApiResponse } from "@/core/http";
import { formatPrice, discountPercent } from "@/lib/utils";
import {
  Card,
  AdminButton,
  Badge,
  StatusPill,
  StatCard,
  KeyValueList,
  Timeline,
  TableSkeleton,
  EmptyState,
  AdminBreadcrumb,
} from "@/app/admin/_components";

/** humanise an ISO timestamp for the activity timeline */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function ProductDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "missing">("loading");
  const [copied, setCopied] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [res, colsRes, prodsRes] = await Promise.all([
          fetch(`/api/v1/products/${id}`),
          fetch(`/api/v1/collections`),
          fetch(`/api/v1/products`),
        ]);
        const body = (await res.json()) as ApiResponse<Product>;
        const colsBody = (await colsRes.json()) as ApiResponse<Collection[]>;
        const prodsBody = (await prodsRes.json()) as ApiResponse<Product[]>;
        if (colsBody.success) setCollections(colsBody.data);
        if (prodsBody.success) setAllProducts(prodsBody.data);
        if (body.success) {
          setProduct(body.data);
          setStatus("ok");
        } else setStatus("missing");
      } catch {
        setStatus("missing");
      }
    })();
  }, [id]);

  if (status === "loading") return <TableSkeleton rows={6} cols={2} />;
  if (status === "missing" || !product)
    return <EmptyState title="Product not found" message="This product may have been deleted." />;

  const p = product;
  const discount = discountPercent(p.mrp, p.price);
  const gallery = p.images?.length ? p.images : [p.image];
  const statusTone: "green" | "gold" | "blue" | "muted" =
    p.status === "active"
      ? "green"
      : p.status === "draft"
        ? "gold"
        : p.status === "review"
          ? "blue"
          : "muted";
  const productCollections = collections.filter((c) => p.collections?.includes(c.id));
  const relatedProducts = allProducts.filter((rp) => p.related?.includes(rp.id));
  const scheduled =
    p.publishAt && (p.status === "draft" || p.status === "review")
      ? new Date(p.publishAt)
      : null;

  return (
    <div>
      <AdminBreadcrumb items={[{ label: "Products", href: "/admin/products" }, { label: p.name }]} />

      {/* header */}
      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/products")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04]"
            style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--a-fg)" }}>
              {p.name}
            </h1>
            <p className="text-sm" style={{ color: "var(--a-muted)" }}>
              {p.attributes.stone}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <AdminButton variant="outline" onClick={() => window.open(`/product/${p.slug}`, "_blank")}>
            <Eye size={16} /> View on store
          </AdminButton>
          <AdminButton onClick={() => router.push(`/admin/products/${p.id}/edit`)}>
            <Pencil size={16} /> Edit
          </AdminButton>
        </div>
      </div>

      {/* scheduled publish banner */}
      {scheduled && (
        <div
          className="mb-5 flex items-center gap-3 rounded-lg border px-4 py-3"
          style={{ borderColor: "var(--a-gold)", background: "var(--a-gold-soft)" }}
        >
          <CalendarClock size={18} className="text-[var(--a-gold)]" />
          <p className="text-sm" style={{ color: "var(--a-fg)" }}>
            Scheduled to go live on{" "}
            <span className="font-semibold">{scheduled.toLocaleString()}</span>
          </p>
        </div>
      )}

      {/* mini stats (mock analytics) */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Eye} value="1,284" label="Views" change="+8%" tone="blue" />
        <StatCard icon={TrendingUp} value="42" label="Sold" change="+12%" tone="green" />
        <StatCard icon={Star} value={p.rating.toFixed(1)} label={`${p.reviews} reviews`} tone="gold" />
        <StatCard icon={Boxes} value={p.stockQty ?? 0} label="In stock" tone={(p.stockQty ?? 0) <= 3 ? "rose" : "royal"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* left */}
        <div className="space-y-6">
          {/* gallery */}
          <Card>
            <h2 className="mb-4 font-semibold" style={{ color: "var(--a-fg)" }}>
              Gallery
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {gallery.map((url, i) => (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.03 }}
                  className="relative aspect-square overflow-hidden rounded-lg border"
                  style={{ borderColor: i === 0 ? "var(--a-gold)" : "var(--a-border)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={p.name} className="h-full w-full object-cover" />
                  {i === 0 && (
                    <span className="absolute left-1.5 top-1.5 rounded bg-[var(--a-gold)] px-1.5 py-0.5 text-[9px] font-bold text-white">
                      Cover
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </Card>

          {/* description */}
          <Card>
            <h2 className="mb-2 font-semibold" style={{ color: "var(--a-fg)" }}>
              Description
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--a-muted)" }}>
              {p.shortDescription || "No description provided."}
            </p>
            {p.attributes.benefits.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {p.attributes.benefits.map((b) => (
                  <Badge key={b} tone="royal">
                    {b}
                  </Badge>
                ))}
              </div>
            )}
          </Card>

          {/* variants */}
          {p.variants && p.variants.length > 0 && (
            <Card>
              <h2 className="mb-4 font-semibold" style={{ color: "var(--a-fg)" }}>
                Variants
              </h2>
              <div className="space-y-2">
                {p.variants.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                    style={{ borderColor: "var(--a-border)" }}
                  >
                    <span className="font-medium" style={{ color: "var(--a-fg)" }}>
                      {v.label}
                    </span>
                    <div className="flex items-center gap-4 text-sm">
                      <span style={{ color: "var(--a-muted)" }}>Stock: {v.stockQty}</span>
                      <span className="font-semibold" style={{ color: "var(--a-fg)" }}>
                        {formatPrice(v.price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* rich content sections */}
          {p.content && p.content.length > 0 && (
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <FileText size={16} className="text-[var(--a-gold)]" />
                <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>
                  Content sections
                </h2>
              </div>
              <div className="space-y-3">
                {p.content.map((s) => (
                  <div key={s.id} className="rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
                    <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>
                      {s.heading}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--a-muted)" }}>
                      {s.body}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* videos & 360 */}
          {p.videos && p.videos.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>
                Video & 360°
              </h2>
              <div className="space-y-2">
                {p.videos.map((v) => (
                  <a
                    key={v.id}
                    href={v.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-black/[0.03]"
                    style={{ borderColor: "var(--a-border)" }}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: "var(--a-surface-2)", color: "var(--a-gold)" }}
                    >
                      {v.kind === "spin360" ? <Rotate3d size={15} /> : <Video size={15} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" style={{ color: "var(--a-fg)" }}>
                        {v.label || (v.kind === "spin360" ? "360° Spin" : "Video")}
                      </span>
                      <span className="block truncate text-xs" style={{ color: "var(--a-faint)" }}>
                        {v.url}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </Card>
          )}

          {/* related products */}
          {relatedProducts.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>
                Related products
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {relatedProducts.map((rp) => (
                  <button
                    key={rp.id}
                    onClick={() => router.push(`/admin/products/${rp.id}`)}
                    className="group overflow-hidden rounded-lg border text-left transition-colors hover:border-[var(--a-gold)]"
                    style={{ borderColor: "var(--a-border)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={rp.image} alt={rp.name} className="aspect-square w-full object-cover" />
                    <span className="block truncate p-2 text-xs font-medium" style={{ color: "var(--a-fg)" }}>
                      {rp.name}
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* activity timeline */}
          {p.activity && p.activity.length > 0 && (
            <Card>
              <h2 className="mb-4 font-semibold" style={{ color: "var(--a-fg)" }}>
                Activity
              </h2>
              <Timeline
                items={p.activity.slice(0, 12).map((a) => ({
                  title: a.message,
                  time: `${timeAgo(a.at)}${a.actor ? ` · ${a.actor}` : ""}`,
                  done: a.type === "published" || a.type === "created",
                }))}
              />
            </Card>
          )}
        </div>

        {/* right */}
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>
                Details
              </h2>
              <StatusPill tone={statusTone}>{p.status ?? "active"}</StatusPill>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold" style={{ color: "var(--a-fg)" }}>
                  {formatPrice(p.price)}
                </span>
                {discount > 0 && (
                  <>
                    <span className="text-sm line-through" style={{ color: "var(--a-faint)" }}>
                      {formatPrice(p.mrp)}
                    </span>
                    <Badge tone="green">-{discount}%</Badge>
                  </>
                )}
              </div>
            </div>
            <div className="mt-4">
              <KeyValueList
                items={[
                  { label: "Category", value: <Badge tone="royal">{p.category}</Badge> },
                  { label: "SKU", value: p.sku ?? "—" },
                  { label: "Stock", value: `${p.stockQty ?? 0} units` },
                  { label: "Planet", value: p.attributes.planet },
                  { label: "Origin", value: p.attributes.origin },
                  { label: "Weight", value: `${p.attributes.weightCarat} ct` },
                  { label: "Certification", value: p.attributes.certification },
                  { label: "Colour", value: p.attributes.color },
                ]}
              />
            </div>
          </Card>

          {/* slug/url */}
          <Card>
            <h2 className="mb-2 font-semibold" style={{ color: "var(--a-fg)" }}>
              Store URL
            </h2>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}>
                /product/{p.slug}
              </code>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(`/product/${p.slug}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04]"
                style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}
              >
                {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
              </button>
            </div>
          </Card>

          {/* tags */}
          {p.tags && p.tags.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>
                Tags
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <Badge key={t} tone="gold">
                    {t}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {/* collections + featured */}
          {(productCollections.length > 0 || p.featured) && (
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Layers size={16} className="text-[var(--a-gold)]" />
                <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>
                  Collections
                </h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.featured && <Badge tone="gold">★ Featured</Badge>}
                {productCollections.map((c) => (
                  <Badge key={c.id} tone="royal">
                    {c.title}
                  </Badge>
                ))}
                {productCollections.length === 0 && !p.featured && (
                  <span className="text-sm" style={{ color: "var(--a-faint)" }}>
                    None
                  </span>
                )}
              </div>
            </Card>
          )}

          {/* certificate */}
          {p.certificatePdf && (
            <Card>
              <h2 className="mb-2 font-semibold" style={{ color: "var(--a-fg)" }}>
                Lab certificate
              </h2>
              <a
                href={p.certificatePdf}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-black/[0.03]"
                style={{ borderColor: "var(--a-border)" }}
              >
                <FileText size={18} className="text-[var(--a-gold)]" />
                <span className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>
                  View certificate PDF
                </span>
              </a>
            </Card>
          )}

          {/* SEO preview */}
          {p.seo && (p.seo.metaTitle || p.seo.metaDescription) && (
            <Card>
              <h2 className="mb-2 font-semibold" style={{ color: "var(--a-fg)" }}>
                SEO preview
              </h2>
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}>
                <p className="truncate text-xs" style={{ color: "var(--a-muted)" }}>
                  nakshatra.com › product › {p.slug}
                </p>
                <p className="mt-1 truncate text-sm font-medium text-[#1a0dab]">
                  {p.seo.metaTitle || p.name}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: "var(--a-muted)" }}>
                  {p.seo.metaDescription || p.shortDescription}
                </p>
              </div>
              {p.seo.noindex && (
                <p className="mt-2 text-xs font-medium text-rose-600">⚠ Hidden from search engines (no-index)</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
