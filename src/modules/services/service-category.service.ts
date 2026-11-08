/**
 * Service categories — business rules.
 *   • name unique (case-insensitive), slug unique
 *   • deleting a category never deletes services: they move to another
 *     category or to Uncategorised, and the admin chooses which
 *   • every change is audited
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { auditService } from "@/modules/audit";
import { getServiceRepository } from "./service.repository";
import { getServiceCategoryRepository } from "./service-category.repository";
import type { CreateServiceCategoryDto, UpdateServiceCategoryDto } from "./service.schema";
import type { ServiceCategory, ServiceCategoryList } from "./service-category.types";

const MAX_CATEGORIES = 100;
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "category";
const clean = (s: string) => s.trim().replace(/\s+/g, " ");
const audit = (action: "create" | "update" | "delete", c: { id: string; name: string }, summary: string, actor?: string) =>
  auditService.record({ action, entity: "service", entityId: `category:${c.id}`, entityLabel: c.name, summary, actor });

export const serviceCategoryService = {
  async list(): Promise<ServiceCategoryList> {
    const [cats, counts] = await Promise.all([getServiceCategoryRepository().list(), getServiceRepository().countByCategory()]);
    const known = new Set(cats.map((c) => c.id));
    // Services pointing at a category that no longer exists count as Uncategorised.
    const orphan = Object.entries(counts).filter(([k]) => k && !known.has(k)).reduce((a, [, n]) => a + n, 0);
    return { categories: cats.map((c) => ({ ...c, serviceCount: counts[c.id] ?? 0 })), uncategorised: (counts[""] ?? 0) + orphan };
  },

  /** Visible categories for the storefront. */
  async listPublic(): Promise<ServiceCategory[]> {
    return (await getServiceCategoryRepository().list()).filter((c) => c.visible);
  },

  async exists(id: string) {
    return Boolean(await getServiceCategoryRepository().get(id));
  },

  async create(dto: CreateServiceCategoryDto, actor?: string): Promise<Result<ServiceCategory>> {
    const repo = getServiceCategoryRepository();
    const all = await repo.list();
    if (all.length >= MAX_CATEGORIES) return fail(AppErrors.validation(`You can have at most ${MAX_CATEGORIES} categories`));
    const name = clean(dto.name);
    let slug = dto.slug || slugify(name);
    const clash = await repo.clash(name, slug);
    if (clash === "name") return fail(AppErrors.conflict(`A category called "${name}" already exists`));
    if (clash === "slug") {
      if (dto.slug) return fail(AppErrors.conflict("This URL is already used by another category"));
      for (let i = 2; (await repo.clash(name, slug)) === "slug"; i++) slug = `${slugify(name).slice(0, 60)}-${i}`;
    }
    const now = new Date().toISOString();
    const created = await repo.create({
      name, slug, icon: dto.icon ?? "Sparkles", description: dto.description ?? "", visible: dto.visible ?? true,
      sortOrder: all.reduce((m, c) => Math.max(m, c.sortOrder), 0) + 10, createdAt: now, updatedAt: now,
    });
    if (created === "duplicate") return fail(AppErrors.conflict("A category with this name or URL was just added. Reload and try again."));
    await audit("create", created, `Added service category "${created.name}"`, actor);
    return ok(created);
  },

  async update(id: string, dto: UpdateServiceCategoryDto, actor?: string): Promise<Result<ServiceCategory>> {
    const repo = getServiceCategoryRepository();
    const cur = await repo.get(id);
    if (!cur) return fail(AppErrors.notFound("Category not found"));
    const name = clean(dto.name);
    const clash = await repo.clash(name, dto.slug, id);
    if (clash === "name") return fail(AppErrors.conflict(`A category called "${name}" already exists`));
    if (clash === "slug") return fail(AppErrors.conflict("This URL is already used by another category"));
    const updated = await repo.update(id, { ...dto, name, updatedAt: new Date().toISOString() });
    if (updated === "duplicate") return fail(AppErrors.conflict("A category with this name or URL already exists"));
    if (!updated) return fail(AppErrors.notFound("Category not found"));
    const what = [cur.name !== updated.name ? `renamed "${cur.name}" → "${updated.name}"` : "", cur.slug !== updated.slug ? `URL ${cur.slug} → ${updated.slug}` : "", cur.visible !== updated.visible ? (updated.visible ? "shown" : "hidden") : ""].filter(Boolean);
    await audit("update", updated, `Updated service category "${updated.name}"${what.length ? `: ${what.join(", ")}` : ""}`, actor);
    return ok(updated);
  },

  async reorder(ids: string[], actor?: string): Promise<Result<ServiceCategoryList>> {
    const repo = getServiceCategoryRepository();
    const all = await repo.list();
    const known = new Set(all.map((c) => c.id));
    if (ids.length !== all.length || ids.some((i) => !known.has(i))) return fail(AppErrors.conflict("Categories changed while you were sorting. Reload and try again."));
    await repo.setOrder(ids);
    await auditService.record({ action: "update", entity: "service", entityId: "categories", entityLabel: "Service categories", summary: "Reordered service categories", actor });
    return ok(await this.list());
  },

  /** Delete; its services move to `moveTo` (category id) or Uncategorised (null). */
  async remove(id: string, moveTo: string | null | undefined, actor?: string): Promise<Result<{ id: string; moved: number }>> {
    const repo = getServiceCategoryRepository();
    const cur = await repo.get(id);
    if (!cur) return fail(AppErrors.notFound("Category not found"));
    const count = (await getServiceRepository().countByCategory())[id] ?? 0;
    if (count > 0 && moveTo === undefined) {
      return fail(AppErrors.conflict(`${count} service${count > 1 ? "s are" : " is"} in this category. Choose where to move ${count > 1 ? "them" : "it"} first.`, { serviceCount: count }));
    }
    let target: ServiceCategory | null = null;
    if (moveTo) {
      if (moveTo === id) return fail(AppErrors.validation("Choose a different category to move services into"));
      target = await repo.get(moveTo);
      if (!target) return fail(AppErrors.notFound("The target category no longer exists"));
    }
    const services = getServiceRepository();
    // Two passes: a service saved into this category during the move is caught by the second.
    const moved = (await services.moveCategory(id, moveTo ?? null)) + (await services.moveCategory(id, moveTo ?? null));
    await repo.remove(id);
    await audit("delete", cur, `Deleted service category "${cur.name}"${moved ? ` (${moved} services moved to ${target ? `"${target.name}"` : "Uncategorised"})` : ""}`, actor);
    return ok({ id, moved });
  },
};
