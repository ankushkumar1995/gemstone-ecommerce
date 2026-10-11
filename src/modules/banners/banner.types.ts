/**
 * Banners domain — types. Admin-managed promotional banners rendered on the
 * storefront (homepage promo strip, hero slots…). Each banner has a
 * `placement` so the storefront can pull the right one(s).
 */

export type BannerPlacement = "hero" | "promo" | "strip";

export interface Banner {
  id: string;
  placement: BannerPlacement;
  eyebrow?: string; // small label above the title
  title: string;
  subtitle?: string;
  image?: string;
  ctaLabel?: string;
  ctaHref?: string;
  order: number; // display order within a placement
  active: boolean;
  startsAt?: string; // ISO
  endsAt?: string; // ISO
  createdAt: string;
}

export interface CreateBannerInput {
  placement: BannerPlacement;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  image?: string;
  ctaLabel?: string;
  ctaHref?: string;
  order?: number;
  active?: boolean;
  startsAt?: string;
  endsAt?: string;
}
