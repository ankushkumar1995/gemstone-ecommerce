/**
 * Categories domain — service (business logic). Dynamic, admin-managed
 * product categories (replaces the old hardcoded enum).
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import type { Category } from "@/types";
import { getCategoryRepository } from "./category.repository";
import type { CreateCategoryDto, UpdateCategoryDto } from "./category.schema";

const DEFAULT_TINT =
  "linear-gradient(135deg, rgba(145,105,255,0.32), rgba(11,8,32,0.1))";
const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&w=1200&q=80";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const categoryService = {
  async list(): Promise<Result<Category[]>> {
    const repo = getCategoryRepository();
    return ok(await repo.findAll());
  },

  async getById(id: string): Promise<Result<Category>> {
    const repo = getCategoryRepository();
    const c = await repo.findById(id);
    if (!c) return fail(AppErrors.notFound("Category not found"));
    return ok(c);
  },

  async create(dto: CreateCategoryDto): Promise<Result<Category>> {
    const repo = getCategoryRepository();
    let slug = slugify(dto.title);
    if (await repo.findBySlug(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const all = await repo.findAll();
    const maxOrder = all.reduce((m, c) => Math.max(m, c.order ?? 0), 0);

    const category: Category = {
      id: newId("cat"),
      slug,
      title: dto.title.trim(),
      tagline: dto.tagline?.trim() || "",
      image: dto.image?.trim() || PLACEHOLDER_IMAGE,
      tint: dto.tint?.trim() || DEFAULT_TINT,
      order: dto.order ?? maxOrder + 1,
      createdAt: new Date().toISOString(),
    };
    return ok(await repo.create(category));
  },

  async update(id: string, dto: UpdateCategoryDto): Promise<Result<Category>> {
    const repo = getCategoryRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Category not found"));

    const patch: Partial<Category> = {
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.tagline !== undefined && { tagline: dto.tagline || "" }),
      ...(dto.image !== undefined && dto.image !== "" && { image: dto.image.trim() }),
      ...(dto.tint !== undefined && dto.tint !== "" && { tint: dto.tint.trim() }),
      ...(dto.order !== undefined && { order: dto.order }),
    };

    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Category not found"));
    return ok(updated);
  },

  async remove(id: string): Promise<Result<{ id: string }>> {
    const repo = getCategoryRepository();
    const removed = await repo.remove(id);
    if (!removed) return fail(AppErrors.notFound("Category not found"));
    return ok({ id });
  },
};
