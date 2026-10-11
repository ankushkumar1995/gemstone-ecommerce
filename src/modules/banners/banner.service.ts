/**
 * Banners domain — service. Admin CRUD + storefront read (active banners for
 * a placement, respecting the schedule window and order).
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import { getBannerRepository } from "./banner.repository";
import type { Banner, BannerPlacement } from "./banner.types";
import type { CreateBannerDto, UpdateBannerDto } from "./banner.schema";

function isLive(b: Banner): boolean {
  if (!b.active) return false;
  const now = Date.now();
  if (b.startsAt && new Date(b.startsAt).getTime() > now) return false;
  if (b.endsAt && new Date(b.endsAt).getTime() < now) return false;
  return true;
}

export const bannerService = {
  async list(): Promise<Result<Banner[]>> {
    const repo = getBannerRepository();
    const all = await repo.findAll();
    all.sort((a, b) => a.order - b.order);
    return ok(all);
  },

  async getById(id: string): Promise<Result<Banner>> {
    const repo = getBannerRepository();
    const b = await repo.findById(id);
    if (!b) return fail(AppErrors.notFound("Banner not found"));
    return ok(b);
  },

  async create(dto: CreateBannerDto): Promise<Result<Banner>> {
    const repo = getBannerRepository();
    const all = await repo.findAll();
    const maxOrder = all
      .filter((b) => b.placement === dto.placement)
      .reduce((m, b) => Math.max(m, b.order), 0);

    const banner: Banner = {
      id: newId("ban"),
      placement: dto.placement,
      eyebrow: dto.eyebrow?.trim() || undefined,
      title: dto.title.trim(),
      subtitle: dto.subtitle?.trim() || undefined,
      image: dto.image?.trim() || undefined,
      ctaLabel: dto.ctaLabel?.trim() || undefined,
      ctaHref: dto.ctaHref?.trim() || undefined,
      order: dto.order ?? maxOrder + 1,
      active: dto.active ?? true,
      startsAt: dto.startsAt || undefined,
      endsAt: dto.endsAt || undefined,
      createdAt: new Date().toISOString(),
    };
    return ok(await repo.create(banner));
  },

  async update(id: string, dto: UpdateBannerDto): Promise<Result<Banner>> {
    const repo = getBannerRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Banner not found"));

    const patch: Partial<Banner> = {
      ...(dto.placement !== undefined && { placement: dto.placement }),
      ...(dto.eyebrow !== undefined && { eyebrow: dto.eyebrow || undefined }),
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.subtitle !== undefined && { subtitle: dto.subtitle || undefined }),
      ...(dto.image !== undefined && { image: dto.image || undefined }),
      ...(dto.ctaLabel !== undefined && { ctaLabel: dto.ctaLabel || undefined }),
      ...(dto.ctaHref !== undefined && { ctaHref: dto.ctaHref || undefined }),
      ...(dto.order !== undefined && { order: dto.order }),
      ...(dto.active !== undefined && { active: dto.active }),
      ...(dto.startsAt !== undefined && { startsAt: dto.startsAt || undefined }),
      ...(dto.endsAt !== undefined && { endsAt: dto.endsAt || undefined }),
    };

    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Banner not found"));
    return ok(updated);
  },

  async remove(id: string): Promise<Result<{ id: string }>> {
    const repo = getBannerRepository();
    const removed = await repo.remove(id);
    if (!removed) return fail(AppErrors.notFound("Banner not found"));
    return ok({ id });
  },

  /** Storefront: live banners for a placement, ordered. */
  async forPlacement(placement: BannerPlacement): Promise<Result<Banner[]>> {
    const repo = getBannerRepository();
    const all = await repo.findAll();
    const live = all
      .filter((b) => b.placement === placement && isLive(b))
      .sort((a, b) => a.order - b.order);
    return ok(live);
  },
};
