/**
 * Pages (CMS) domain — service. Admin CRUD + storefront read helpers
 * (published list for footer, by-slug for the page route).
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import { getPageRepository } from "./page.repository";
import type { CmsPage } from "./page.types";
import type { CreatePageDto, UpdatePageDto } from "./page.schema";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const pageService = {
  async list(): Promise<Result<CmsPage[]>> {
    const repo = getPageRepository();
    return ok(await repo.findAll());
  },

  async getById(id: string): Promise<Result<CmsPage>> {
    const repo = getPageRepository();
    const p = await repo.findById(id);
    if (!p) return fail(AppErrors.notFound("Page not found"));
    return ok(p);
  },

  async create(dto: CreatePageDto): Promise<Result<CmsPage>> {
    const repo = getPageRepository();
    let slug = slugify(dto.title);
    if (await repo.findBySlug(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const page: CmsPage = {
      id: newId("page"),
      slug,
      title: dto.title.trim(),
      content: dto.content || "",
      status: dto.status ?? "draft",
      seoTitle: dto.seoTitle || undefined,
      seoDescription: dto.seoDescription || undefined,
      showInFooter: dto.showInFooter ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return ok(await repo.create(page));
  },

  async update(id: string, dto: UpdatePageDto): Promise<Result<CmsPage>> {
    const repo = getPageRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Page not found"));

    const patch: Partial<CmsPage> = {
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.content !== undefined && { content: dto.content }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.seoTitle !== undefined && { seoTitle: dto.seoTitle || undefined }),
      ...(dto.seoDescription !== undefined && { seoDescription: dto.seoDescription || undefined }),
      ...(dto.showInFooter !== undefined && { showInFooter: dto.showInFooter }),
      updatedAt: new Date().toISOString(),
    };

    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Page not found"));
    return ok(updated);
  },

  async remove(id: string): Promise<Result<{ id: string }>> {
    const repo = getPageRepository();
    const removed = await repo.remove(id);
    if (!removed) return fail(AppErrors.notFound("Page not found"));
    return ok({ id });
  },

  /* ---------------- storefront ---------------- */
  async getPublishedBySlug(slug: string): Promise<Result<CmsPage>> {
    const repo = getPageRepository();
    const p = await repo.findBySlug(slug);
    if (!p || p.status !== "published") return fail(AppErrors.notFound("Page not found"));
    return ok(p);
  },

  async footerPages(): Promise<Result<CmsPage[]>> {
    const repo = getPageRepository();
    const all = await repo.findAll();
    return ok(all.filter((p) => p.status === "published" && p.showInFooter));
  },
};
