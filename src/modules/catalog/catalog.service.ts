import "server-only";

/**
 * Public catalog for API clients (mobile app now; anything else later).
 *
 * The website renders services server-side through serviceService, so these
 * shapes are only for API consumers. Everything here is channel-aware: the
 * caller's channel decides what is visible (see core/channels).
 *
 * Kept deliberately small and stable: only fields a client needs, plain-text
 * versions of rich text, no admin fields.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import type { Channel } from "@/core/channels";
import { serviceService, serviceCategoryService } from "@/modules/services";
import type { AstroService } from "@/types";

export interface CatalogCategory { id: string; name: string; slug: string; icon: string; count: number }

export interface CatalogService {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  /** Plain text (rich text flattened, paragraphs separated by blank lines). */
  description: string;
  /** Original rich text, for clients that can render HTML. */
  descriptionHtml: string;
  icon: string;
  image: string | null;
  /** INR. 0 = free / price on request. */
  priceFrom: number;
  duration: string;
  popular: boolean;
  features: string[];
  category: { id: string; name: string; slug: string } | null;
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** Rich text (TipTap HTML) → readable plain text. Plain text passes through. */
export function htmlToText(html: string): string {
  if (!html) return "";
  if (!/<[a-z][\s\S]*>/i.test(html)) return html.trim();
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\/\s*(p|div|h[1-6]|li|blockquote|ul|ol)\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toCatalog(s: AstroService, cats: Map<string, { id: string; name: string; slug: string }>): CatalogService {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    tagline: s.tagline ?? "",
    description: htmlToText(s.description ?? ""),
    descriptionHtml: s.description ?? "",
    icon: s.icon || "Sparkles",
    image: s.image || null,
    priceFrom: s.priceFrom ?? 0,
    duration: s.duration || "30 min",
    popular: Boolean(s.popular),
    features: (s.features ?? []).filter(Boolean),
    category: (s.categoryId && cats.get(s.categoryId)) || null,
  };
}

async function visibleCategories() {
  // A category problem must never take the service list down.
  const list = await serviceCategoryService.listPublic().catch(() => []);
  return new Map(list.map((c) => [c.id, { id: c.id, name: c.name, slug: c.slug, icon: c.icon }]));
}

export const catalogService = {
  /** Services visible on `channel`, in admin order, plus the categories that have any. */
  async services(channel: Channel): Promise<Result<{ services: CatalogService[]; categories: CatalogCategory[] }>> {
    const [res, cats] = await Promise.all([serviceService.listActive(channel), visibleCategories()]);
    if (!res.ok) return res;
    const services = res.value.map((s) => toCatalog(s, cats));
    // Only categories that actually have something on this channel, in admin order.
    const count = new Map<string, number>();
    for (const s of services) if (s.category) count.set(s.category.id, (count.get(s.category.id) ?? 0) + 1);
    const categories = [...cats.values()]
      .filter((c) => count.has(c.id))
      .map((c) => ({ ...c, count: count.get(c.id) ?? 0 }));
    return ok({ services, categories });
  },

  /** One service by slug, or 404 when it is hidden / not on this channel. */
  async service(slug: string, channel: Channel): Promise<Result<{ service: CatalogService; related: CatalogService[] }>> {
    const [res, all, cats] = await Promise.all([serviceService.getActiveBySlug(slug, channel), serviceService.listActive(channel), visibleCategories()]);
    if (!res.ok) return fail(AppErrors.notFound("Service not found"));
    const service = toCatalog(res.value, cats);
    const others = (all.ok ? all.value : []).filter((s) => s.id !== service.id).map((s) => toCatalog(s, cats));
    const sameCat = service.category ? others.filter((s) => s.category?.id === service.category?.id) : [];
    const related = [...sameCat, ...others.filter((s) => !sameCat.includes(s))].slice(0, 6);
    return ok({ service, related });
  },
};
