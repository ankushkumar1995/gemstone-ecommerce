/**
 * Categories domain — service (business logic). Dynamic, admin-managed
 * product categories (replaces the old hardcoded enum).
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { cache } from "@/core/cache";
import { paginate, type ListParams, type Paginated } from "@/core/query";
import type { Category, CategoryTreeNode } from "@/types";
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

/** Normalize a parentId coming off a DTO: "" / undefined → null (top-level). */
function normalizeParentId(raw: string | null | undefined): string | null {
  const v = (raw ?? "").toString().trim();
  return v === "" ? null : v;
}

/**
 * Validate a requested parent and compute the ancestors chain for a 2-level
 * taxonomy. `selfId` is the category being edited (omitted on create) so we can
 * reject self-parenting and illegal re-parents.
 *
 * Rules enforced:
 *  • parent must exist and not be soft-deleted
 *  • parent must itself be top-level (no grandparents → 2 levels max)
 *  • a category cannot be its own parent
 *  • a category that already has children cannot become a child (would create
 *    a 3rd level under it)
 */
async function resolveParent(
  parentId: string | null,
  selfId: string | undefined,
): Promise<Result<{ parentId: string | null; ancestors: string[] }>> {
  if (parentId === null) {
    return ok({ parentId: null, ancestors: [] });
  }

  const repo = getCategoryRepository();

  if (selfId && parentId === selfId) {
    return fail(AppErrors.validation("A category cannot be its own parent"));
  }

  const parent = await repo.findById(parentId);
  if (!parent) {
    return fail(AppErrors.validation("Selected parent category does not exist"));
  }

  // 2-level rule: the chosen parent must be top-level.
  if (parent.parentId) {
    return fail(
      AppErrors.validation(
        "Categories can only be nested two levels deep. Pick a top-level category as the parent.",
      ),
    );
  }

  // Prevent turning a parent-of-children into a child (would create a 3rd level).
  if (selfId) {
    const childCount = await repo.countChildren(selfId);
    if (childCount > 0) {
      return fail(
        AppErrors.validation(
          "This category already has sub-categories, so it cannot itself become a sub-category.",
        ),
      );
    }
  }

  return ok({ parentId: parent.id, ancestors: [parent.id] });
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

    // Resolve + validate the parent and derive the ancestors chain.
    const parent = await resolveParent(normalizeParentId(dto.parentId), undefined);
    if (!parent.ok) return parent;

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
      parentId: parent.value.parentId,
      ancestors: parent.value.ancestors,
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

    // Re-parenting: only when the client actually sent parentId. Validate the
    // new parent (2-level, exists, no self/cycle, not-a-parent-already) and
    // recompute the ancestors chain. Because a category with children can never
    // become a child, its own children's ancestors can never go stale here.
    if (dto.parentId !== undefined) {
      const nextParentId = normalizeParentId(dto.parentId);
      if (nextParentId !== (existing.parentId ?? null)) {
        const parent = await resolveParent(nextParentId, id);
        if (!parent.ok) return parent;
        patch.parentId = parent.value.parentId;
        patch.ancestors = parent.value.ancestors;
      }
    }

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
    // Safe production default: never orphan sub-categories. Block deleting a
    // parent while it still has children — the admin must remove or re-parent
    // them first. This keeps the ancestors chain and product links consistent.
    const childCount = await repo.countChildren(id);
    if (childCount > 0) {
      return fail(
        AppErrors.conflict(
          `This category has ${childCount} sub-${childCount === 1 ? "category" : "categories"}. Delete or move them before deleting this category.`,
        ),
      );
    }
    const removed = await repo.remove(id);
    if (!removed) return fail(AppErrors.notFound("Category not found"));
    invalidate();
    return ok({ id });
  },

  /**
   * Full taxonomy as a tree: top-level categories each with their direct
   * children nested. Used by the admin manager and storefront navigation.
   * Built from a single `findAll()` (one query) — no N+1.
   */
  async tree(): Promise<Result<CategoryTreeNode[]>> {
    const repo = getCategoryRepository();
    const all = await cache.wrap(CACHE_ALL, CACHE_TTL, () => repo.findAll());

    const byParent = new Map<string, Category[]>();
    const roots: Category[] = [];
    for (const c of all) {
      if (c.parentId) {
        const list = byParent.get(c.parentId) ?? [];
        list.push(c);
        byParent.set(c.parentId, list);
      } else {
        roots.push(c);
      }
    }

    const sortByOrder = (a: Category, b: Category) => (a.order ?? 999) - (b.order ?? 999);
    const nodes: CategoryTreeNode[] = roots
      .sort(sortByOrder)
      .map((root) => ({
        ...root,
        children: (byParent.get(root.id) ?? []).sort(sortByOrder),
      }));
    return ok(nodes);
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
