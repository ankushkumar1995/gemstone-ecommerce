import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";
import { products } from "@/data/products";
import { articleService } from "@/modules/blog";
import { serviceService } from "@/modules/services";
import { pageService } from "@/modules/pages";

/**
 * Dynamic XML sitemap. Pulls live slugs from the data layer (products, blog,
 * services, CMS pages) so search engines always see the current catalogue.
 * Runs at request time because it reads from the repositories.
 */
export const dynamic = "force-dynamic";

const BASE = BRAND.url.replace(/\/$/, "");

/** Static, always-present storefront routes with sensible crawl priorities. */
const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "/shop", changeFrequency: "daily", priority: 0.9 },
  { path: "/services", changeFrequency: "weekly", priority: 0.8 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.6 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.5 },
  { path: "/policies", changeFrequency: "yearly", priority: 0.4 },
  { path: "/track-order", changeFrequency: "monthly", priority: 0.4 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${BASE}/product/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const [articlesRes, servicesRes, pagesRes] = await Promise.all([
    articleService.listPublished(),
    serviceService.listActive(),
    pageService.footerPages(),
  ]);

  const articleEntries: MetadataRoute.Sitemap = articlesRes.ok
    ? articlesRes.value.map((a) => ({
        url: `${BASE}/blog/${a.slug}`,
        lastModified: a.updatedAt ? new Date(a.updatedAt) : now,
        changeFrequency: "monthly",
        priority: 0.6,
      }))
    : [];

  const serviceEntries: MetadataRoute.Sitemap = servicesRes.ok
    ? servicesRes.value.map((s) => ({
        url: `${BASE}/services/${s.slug}`,
        lastModified: s.updatedAt ? new Date(s.updatedAt) : now,
        changeFrequency: "monthly",
        priority: 0.6,
      }))
    : [];

  const pageEntries: MetadataRoute.Sitemap = pagesRes.ok
    ? pagesRes.value.map((pg) => ({
        url: `${BASE}/pages/${pg.slug}`,
        lastModified: pg.updatedAt ? new Date(pg.updatedAt) : now,
        changeFrequency: "monthly",
        priority: 0.4,
      }))
    : [];

  return [
    ...staticEntries,
    ...productEntries,
    ...serviceEntries,
    ...articleEntries,
    ...pageEntries,
  ];
}
