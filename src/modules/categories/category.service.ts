/**
 * Categories domain — service (business logic). Dynamic, admin-managed
 * product categories (replaces the old hardcoded enum).
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { cache } from "@/core/cache";
import { paginate, type ListParams, type Paginated } from "@/core/query";
import type { Category } from "@/types";
import { getCategoryRepository } from "./category.repository";
import type { CreateCategoryDto, UpdateCategoryDto } from "./category.schema";

/** Cache keys for this module (invalidated on any write). */
const CACHE_ALL = "categories:all";
const CACHE_TTL = 60; // seconds

function invalidate() {
  cache.delByPrefix("categories:");
}

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
    // Cached: categories change rarely but are read on every storefront page.
    const items = await cache.wrap(CACHE_ALL, CACHE_TTL, () => repo.findAll());
    return ok(items);
  },

  /** Paginated + searchable listing for the admin table. */
  async listPaginated(params: ListParams): Promise<Result<Paginated<Category>>> {
    const repo = getCategoryRepository();
    const key = `categories:page:${params.page}:${params.limit}:${JSON.stringify(params.sort)}:${params.q ?? ""}`;
    const result = await cache.wrap(key, CACHE_TTL, async () => {
      const { items, total } = await repo.search({
        skip: params.skip,
        limit: params.limit,
        sort: params.sort,
        q: params.q,
      });
      return paginate(items, total, params);
    });
    return ok(result);
  },

  async getById(id: string): Promise<Result<Category>> {
    const repo = getCategoryRepository();
    const c = await repo.findById(id);
    if (!c) return fail(AppErrors.notFound("Category not found"));
    return ok(c);
  },

  /** Storefront lookup by slug (e.g. /category/rings). */
  async getBySlug(slug: string): Promise<Result<Category>> {
    const repo = getCategoryRepository();
    const key = `categories:slug:${slug}`;
    const c = await cache.wrap(key, CACHE_TTL, () => repo.findBySlug(slug));
    if (!c) return fail(AppErrors.notFound("Category not found"));
    return ok(c);
  },

  async create(dto: CreateCategoryDto): Promise<Result<Category>> {
    const repo = getCategoryRepository();
    let slug = slugify(dto.title);
    if (await repo.findBySlug(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const all = await repo.findAll();
    const maxOrder = all.reduce((m, c) => Math.max(m, c.order ?? 0), 0);

    // The DB assigns the id (ObjectId). We only supply the fields.
    const created = await repo.create({
      slug,
      title: dto.title.trim(),
      tagline: dto.tagline?.trim() || "",
      image: dto.image?.trim() || PLACEHOLDER_IMAGE,
      tint: dto.tint?.trim() || DEFAULT_TINT,
      order: dto.order ?? maxOrder + 1,
      status: "active",
    });
    invalidate();
    return ok(created);
  },

  async update(id: string, dto: UpdateCategoryDto): Promise<Result<Category>> {
    const repo = getCategoryRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Category not found"));

    const patch: Partial<Category> = {
      ...(dto.tagline !== undefined && { tagline: dto.tagline || "" }),
      ...(dto.image !== undefined && dto.image !== "" && { image: dto.image.trim() }),
      ...(dto.tint !== undefined && dto.tint !== "" && { tint: dto.tint.trim() }),
      ...(dto.order !== undefined && { order: dto.order }),
      ...(dto.status !== undefined && { status: dto.status }),
    };

    // If the title changes, re-derive the slug and guard its uniqueness so we
    // return a clean 409 instead of letting the DB throw a duplicate-key error.
    if (dto.title !== undefined) {
      const title = dto.title.trim();
      patch.title = title;
      const newSlug = slugify(title);
      if (newSlug !== existing.slug) {
        if (await repo.slugTakenBy(newSlug, id)) {
          return fail(AppErrors.conflict(`A category with slug "${newSlug}" already exists`));
        }
        patch.slug = newSlug;
      }
    }

    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Category not found"));
    invalidate();
    return ok(updated);
  },

  /** Activate / deactivate (storefront visibility) without editing other fields. */
  async setStatus(id: string, status: "active" | "inactive"): Promise<Result<Category>> {
    const repo = getCategoryRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Category not found"));
    const updated = await repo.update(id, { status });
    if (!updated) return fail(AppErrors.notFound("Category not found"));
    invalidate();
    return ok(updated);
  },

  /** Set display order for many categories in one call (drag-to-reorder). */
  async reorder(ids: string[]): Promise<Result<{ count: number }>> {
    const repo = getCategoryRepository();
    const items = ids.map((id, index) => ({ id, order: index + 1 }));
    const okRes = await repo.reorder(items);
    if (!okRes) return fail(AppErrors.validation("Could not reorder categories"));
    invalidate();
    return ok({ count: items.length });
  },

  async remove(id: string): Promise<Result<{ id: string }>> {
    const repo = getCategoryRepository();
    const removed = await repo.remove(id);
    if (!removed) return fail(AppErrors.notFound("Category not found"));
    invalidate();
    return ok({ id });
  },

  /** Undo a soft delete. */
  async restore(id: string): Promise<Result<Category>> {
    const repo = getCategoryRepository();
    const restored = await repo.restore(id);
    if (!restored) return fail(AppErrors.notFound("Deleted category not found"));
    invalidate();
    return ok(restored);
  },
};
