import "server-only";

/**
 * Public pooja / havan catalog for API clients (mobile app).
 *
 * Built on the same storefront functions the website uses
 * (poojaService.storefrontCards / getStorefront), so the rules are identical:
 * only "active" poojas with at least one active package, only active add-ons,
 * public policy fields only, and filtered by the caller's channel.
 *
 * Slots and booking use the existing public routes, which are channel-aware:
 *   GET  /api/v1/poojas/:slug/slots
 *   POST /api/v1/poojas/bookings
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import type { Channel } from "@/core/channels";
import { poojaService, poojaCategoryService } from "@/modules/poojas";
import type {
  HavanConfig, PoojaAddOn, PoojaFaq, PoojaLocation, PoojaPackage, PublicPooja, PublicPoojaCategory, RitualType, SankalpConfig,
} from "@/modules/poojas";
import { htmlToText } from "./catalog.service";

export interface CatalogPoojaCard {
  id: string;
  slug: string;
  type: RitualType;
  title: string;
  subtitle: string;
  deity: string;
  shortDescription: string;
  coverImage: string | null;
  category: { key: string; name: string } | null;
  /** Lowest active package price (INR). */
  priceFrom: number;
  /** Strike-through price for priceFrom, if any. */
  mrpFrom: number | null;
  featured: boolean;
  durationMin: number;
  location: Pick<PoojaLocation, "mode" | "place" | "city" | "state">;
  /** Havans only. */
  havan: Pick<HavanConfig, "mode" | "durationDays"> | null;
  /** First open date, or null when nothing is open right now. */
  next: { date: string; time: string; label: string } | null;
}

export interface CatalogPooja extends CatalogPoojaCard {
  description: string;
  benefits: string[];
  vidhi: string[];
  includes: string[];
  faqs: PoojaFaq[];
  gallery: string[];
  videoUrl: string | null;
  panditCount: number;
  mantraCount: number;
  packages: PoojaPackage[];
  addOns: PoojaAddOn[];
  sankalp: SankalpConfig;
  policy: PublicPooja["policy"];
  schedule: { mode: PublicPooja["schedule"]["mode"]; cutoffHours: number; advanceDays: number };
  havanDetails: HavanConfig | null;
}

type Next = { date: string; time: string; label: string } | null;

function card(p: PublicPooja, cats: Map<string, string>, next: Next): CatalogPoojaCard {
  return {
    id: p.id,
    slug: p.slug,
    type: p.type,
    title: p.title,
    subtitle: p.subtitle ?? "",
    deity: p.deity ?? "",
    shortDescription: p.shortDescription ?? "",
    coverImage: p.coverImage || null,
    category: cats.has(p.category) ? { key: p.category, name: cats.get(p.category)! } : null,
    priceFrom: p.priceFrom,
    mrpFrom: p.mrpFrom,
    featured: Boolean(p.featured),
    durationMin: p.durationMin ?? 0,
    location: { mode: p.location.mode, place: p.location.place ?? "", city: p.location.city ?? "", state: p.location.state ?? "" },
    havan: p.type === "havan" ? { mode: p.havan.mode, durationDays: p.havan.durationDays } : null,
    next,
  };
}

const catMap = (cats: PublicPoojaCategory[]) => new Map(cats.map((c) => [c.key, c.name]));

export const catalogPoojaService = {
  /** Cards for one ritual type + category chips (only categories with something on this channel). */
  async list(type: RitualType, channel: Channel): Promise<Result<{ poojas: CatalogPoojaCard[]; categories: PublicPoojaCategory[] }>> {
    // storefrontCards never throws (returns empty lists on DB problems), same as the website.
    const data = await poojaService.storefrontCards(type, channel);
    const cats = catMap(data.categories);
    return ok({ poojas: data.poojas.map((p) => card(p, cats, p.next)), categories: data.categories });
  },

  /** Full detail by slug, or 404 when hidden / not bookable / not on this channel. */
  async detail(slug: string, channel: Channel): Promise<Result<{ pooja: CatalogPooja }>> {
    const r = await poojaService.getStorefront(slug, channel);
    if (!r.ok) return fail(AppErrors.notFound("Pooja not found"));
    const p = r.value;
    const [cats, nextMap] = await Promise.all([
      poojaCategoryService.listStorefront([p]).catch(() => [] as PublicPoojaCategory[]),
      poojaService.nextOpen([p]).catch(() => ({} as Record<string, null>)),
    ]);
    const s = nextMap[p.id];
    const base = card(p, catMap(cats), s ? { date: s.date, time: s.time, label: s.label } : null);
    return ok({
      pooja: {
        ...base,
        description: htmlToText(p.description ?? ""),
        benefits: (p.benefits ?? []).filter(Boolean),
        vidhi: (p.vidhi ?? []).filter(Boolean),
        includes: (p.includes ?? []).filter(Boolean),
        faqs: p.faqs ?? [],
        gallery: (p.gallery ?? []).filter(Boolean),
        videoUrl: p.videoUrl || null,
        panditCount: p.panditCount ?? 1,
        mantraCount: p.mantraCount ?? 0,
        packages: p.packages,
        addOns: p.addOns,
        sankalp: p.sankalp,
        policy: p.policy,
        schedule: { mode: p.schedule.mode, cutoffHours: p.schedule.cutoffHours, advanceDays: p.schedule.advanceDays },
        havanDetails: p.type === "havan" ? p.havan : null,
      },
    });
  },
};
