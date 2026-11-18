import "server-only";

/**
 * Public product catalogue for API clients (the mobile app). Only ACTIVE
 * products switched on for the caller's channel. Customer-safe fields only:
 * no cost price, internal notes, warehouse or audit data. Stock is shown as
 * "in stock / only N left / sold out", never the exact count above the
 * low-stock threshold.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { isVisibleOn, type Channel } from "@/core/channels";
import { productService } from "@/modules/products";
import { settingsService } from "@/modules/settings";
import { resolveConfig, type ResolvedConfigurator } from "@/modules/configurator";
import type { Product } from "@/types";
import { htmlToText } from "./catalog.service";

export interface CatalogVariant { sku: string; label: string; options: Record<string, string>; price: number; mrp: number; image: string | null; stock: StockView; isDefault: boolean }

export type StockView = { state: "in_stock" } | { state: "low"; left: number } | { state: "sold_out" } | { state: "made_to_order" };

export interface CatalogProductCard {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  image: string | null;
  price: number;
  mrp: number;
  rating: number;
  reviews: number;
  badge: string | null;
  category: { slug: string; name: string } | null;
  stone: string;
  planet: string;
  zodiac: string[];
  weightCarat: number | null;
  certified: boolean;
  stock: StockView;
  hasOptions: boolean;
  featured: boolean;
  /** Can be made into a ring / pendant (configurator wear group is on). */
  customizable: boolean;
}

export interface CatalogProductDetail extends CatalogProductCard {
  images: string[];
  shortDescription: string;
  description: string;
  gemstone: { stone: string; planet: string; origin: string; weightCarat: number | null; color: string; clarity: string; cut: string; treatment: string; certification: string; labName: string; certificateNumber: string; benefits: string[] };
  specifications: { label: string; value: string }[];
  faqs: { q: string; a: string }[];
  certificatePdf: string | null;
  videos: { url: string; kind: "video" | "spin360"; label: string }[];
  options: { name: string; values: string[] }[];
  variants: CatalogVariant[];
  configurator: ResolvedConfigurator | null;
  related: CatalogProductCard[];
}

const pretty = (slug: string) => slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()).trim();

function stockOf(qty: number, low: number, tracked: boolean, backorder: boolean): StockView {
  if (!tracked) return { state: "in_stock" };
  if (qty <= 0) return backorder ? { state: "made_to_order" } : { state: "sold_out" };
  return qty <= Math.max(1, low) ? { state: "low", left: qty } : { state: "in_stock" };
}

type GlobalCfg = Parameters<typeof resolveConfig>[1];

function card(p: Product, globalCfg: GlobalCfg = null): CatalogProductCard {
  const g = p.gemstone ?? {};
  const active = (p.fullVariants ?? []).filter((v) => v.active !== false);
  const tracked = p.trackInventory !== false;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    subtitle: p.subtitle ?? "",
    image: p.image || p.coverImage || null,
    price: p.price,
    mrp: Math.max(p.mrp ?? p.price, p.price),
    rating: p.ratingAvg ?? p.rating ?? 0,
    reviews: p.ratingCount ?? p.reviews ?? 0,
    badge: p.badge ?? null,
    category: p.category ? { slug: p.category, name: pretty(p.category) } : null,
    stone: g.stone ?? p.attributes?.stone ?? p.name,
    planet: g.planet ?? "",
    zodiac: (p.zodiac ?? []).map(String),
    weightCarat: g.weightCarat ?? null,
    certified: Boolean(g.certification || g.labName || p.certificatePdf),
    stock: p.hasVariants && active.length
      ? (active.some((v) => !tracked || v.stockQty > 0 || p.allowBackorder) ? { state: "in_stock" } : { state: "sold_out" })
      : stockOf(p.stockQty ?? 0, p.lowStockThreshold ?? 3, tracked, Boolean(p.allowBackorder)),
    hasOptions: Boolean(p.hasVariants && active.length),
    featured: Boolean(p.featured),
    customizable: resolveConfig(p.configurator, globalCfg).wear.show,
  };
}

async function visible(channel: Channel): Promise<Product[]> {
  const res = await productService.list();
  if (!res.ok) return [];
  return res.value.filter((p) => (p.status ?? "active") === "active" && isVisibleOn(p.channels, channel));
}

export interface ProductQuery { q?: string; category?: string; planet?: string; zodiac?: string; sort?: "popular" | "price_asc" | "price_desc" | "new" | "rating"; ids?: string[] }

export const catalogProducts = {
  async list(channel: Channel, f: ProductQuery = {}): Promise<Result<{ products: CatalogProductCard[]; categories: { slug: string; name: string; count: number }[]; planets: string[] }>> {
    const [all, sRes] = await Promise.all([visible(channel), settingsService.get()]);
    const g = sRes.ok ? sRes.value.configurator ?? null : null;
    const cards = all.map((p) => card(p, g));
    const categories = [...cards.reduce((m, c) => (c.category ? m.set(c.category.slug, { ...c.category, count: (m.get(c.category.slug)?.count ?? 0) + 1 }) : m), new Map<string, { slug: string; name: string; count: number }>()).values()];
    const planets = [...new Set(cards.map((c) => c.planet).filter(Boolean))].sort();
    const q = f.q?.trim().toLowerCase();
    let out = cards.filter((c) =>
      (!f.ids?.length || f.ids.includes(c.id)) &&
      (!f.category || c.category?.slug === f.category) &&
      (!f.planet || c.planet.toLowerCase() === f.planet.toLowerCase()) &&
      (!f.zodiac || c.zodiac.includes(f.zodiac.toLowerCase())) &&
      (!q || `${c.name} ${c.subtitle} ${c.stone} ${c.planet} ${c.category?.name ?? ""}`.toLowerCase().includes(q)));
    const created = new Map(all.map((p) => [p.id, (p as { createdAt?: string }).createdAt ?? ""]));
    const sold = (c: CatalogProductCard) => (c.stock.state === "sold_out" ? 1 : 0);
    out = [...out].sort((a, b) => {
      if (sold(a) !== sold(b)) return sold(a) - sold(b); // sold out last
      switch (f.sort) {
        case "price_asc": return a.price - b.price;
        case "price_desc": return b.price - a.price;
        case "rating": return b.rating - a.rating;
        case "new": return (created.get(b.id) ?? "").localeCompare(created.get(a.id) ?? "");
        default: return Number(b.featured) - Number(a.featured) || b.reviews - a.reviews;
      }
    });
    return ok({ products: out.slice(0, 200), categories, planets });
  },

  /** By slug or id; 404 when hidden on this channel. */
  async detail(slugOrId: string, channel: Channel): Promise<Result<{ product: CatalogProductDetail }>> {
    const all = await visible(channel);
    const p = all.find((x) => x.slug === slugOrId || x.id === slugOrId);
    if (!p) return fail(AppErrors.notFound("This product is not available"));
    const sRes = await settingsService.get();
    const resolved = resolveConfig(p.configurator, sRes.ok ? sRes.value.configurator ?? null : null);
    const g = p.gemstone ?? {};
    const tracked = p.trackInventory !== false;
    const base = card(p, sRes.ok ? sRes.value.configurator ?? null : null);
    const relatedIds = new Set([...(p.relatedIds ?? []), ...(p.related ?? [])]);
    const related = [
      ...all.filter((x) => relatedIds.has(x.id)),
      ...all.filter((x) => x.id !== p.id && !relatedIds.has(x.id) && (x.category === p.category || (x.gemstone?.planet && x.gemstone.planet === g.planet))),
    ].filter((x) => x.id !== p.id).slice(0, 8).map((x) => card(x, sRes.ok ? sRes.value.configurator ?? null : null));
    return ok({
      product: {
        ...base,
        images: [...new Set([p.image, ...(p.images ?? [])].filter(Boolean) as string[])],
        shortDescription: p.shortDescription ?? "",
        description: htmlToText(p.description ?? ""),
        gemstone: {
          stone: g.stone ?? "", planet: g.planet ?? "", origin: g.origin ?? "", weightCarat: g.weightCarat ?? null, color: g.color ?? "",
          clarity: g.clarity ?? "", cut: g.cut ?? "", treatment: g.treatment ?? "", certification: g.certification ?? "", labName: g.labName ?? "",
          certificateNumber: g.certificateNumber ?? "", benefits: (g.benefits ?? []).filter(Boolean),
        },
        specifications: (p.specifications ?? []).filter((s) => s.label && s.value).map((s) => ({ label: s.label, value: s.value ?? "" })),
        faqs: (p.faqs ?? []).filter((f) => f.q && f.a).map((f) => ({ q: f.q, a: f.a ?? "" })),
        certificatePdf: p.certificatePdf ?? null,
        videos: (p.videos ?? []).filter((v) => /^https?:\/\//.test(v.url)).map((v) => ({ url: v.url, kind: v.kind, label: v.label ?? "" })),
        options: (p.options ?? []).filter((o) => o.values.length),
        variants: (p.fullVariants ?? []).filter((v) => v.active !== false && v.sku).map((v) => ({
          sku: v.sku!,
          label: Object.values(v.optionValues ?? {}).filter(Boolean).join(" / ") || v.sku!,
          options: v.optionValues ?? {},
          price: v.price ?? p.price,
          mrp: Math.max(v.mrp ?? p.mrp ?? p.price, v.price ?? p.price),
          image: v.image ?? null,
          stock: stockOf(v.stockQty ?? 0, p.lowStockThreshold ?? 3, tracked, Boolean(p.allowBackorder)),
          isDefault: Boolean(v.isDefault),
        })),
        configurator: resolved.hasAny ? resolved : null,
        related,
      },
    });
  },
};
