import "server-only";

/**
 * Poojas — catalog + pandits service.
 *   • publishing (status "active") requires a complete pooja (publishIssues)
 *   • a pooja with bookings can never be hard-deleted: archive it instead
 *   • changing prices or packages never changes existing bookings (snapshots)
 *   • every write is audited with the admin's name
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { auditService } from "@/modules/audit";
import { getPoojaRepository } from "./pooja.repository";
import { buildSlots, istToday, publishIssues } from "./pooja.rules";
import type { CategoryCreateInput, CategoryUpdateInput, PanditInput, PoojaInput } from "./pooja.schema";
import type { Pandit, Pooja, PoojaCategoryItem, PoojaCategoryRow, PoojaListItem, PoojaStatus, PublicPooja, PublicPoojaCategory, RitualType, SlotView } from "./pooja.types";

async function categoryExists(key: string) {
  return Boolean(await getPoojaRepository().getCategory(key));
}

export interface Actor { name: string }

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "pooja";

async function uniqueSlug(base: string, exceptId?: string) {
  const repo = getPoojaRepository();
  let slug = slugify(base);
  for (let i = 2; await repo.slugTaken(slug, exceptId); i++) slug = `${slugify(base).slice(0, 74)}-${i}`;
  return slug;
}

const audit = (action: "create" | "update" | "delete" | "status", p: { id: string; title: string }, summary: string, actor: Actor) =>
  auditService.record({ action, entity: "pooja", entityId: p.id, entityLabel: p.title, summary, actor: actor.name });

export const poojaService = {
  async list(): Promise<Result<PoojaListItem[]>> {
    const repo = getPoojaRepository();
    const [rows, stats] = await Promise.all([repo.listPoojas(), repo.stats(istToday(Date.now()))]);
    return ok(rows.map((p) => ({ ...p, bookings: stats[p.id]?.bookings ?? 0, revenue: stats[p.id]?.revenue ?? 0, upcoming: stats[p.id]?.upcoming ?? 0 })));
  },

  async get(id: string): Promise<Result<Pooja>> {
    const p = await getPoojaRepository().getPooja(id);
    return p ? ok(p) : fail(AppErrors.notFound("Pooja not found"));
  },

  async create(input: PoojaInput, actor: Actor): Promise<Result<Pooja>> {
    const repo = getPoojaRepository();
    if (input.slug && (await repo.slugTaken(input.slug))) return fail(AppErrors.conflict("This URL is already used by another pooja"));
    if (!(await categoryExists(input.category))) return fail(AppErrors.validation("This category no longer exists. Choose another one.", [{ field: "category", message: "Choose a category" }]));
    const now = new Date().toISOString();
    const draft: Omit<Pooja, "id"> = { ...input, slug: input.slug || (await uniqueSlug(input.title)), createdBy: actor.name, updatedBy: actor.name, createdAt: now, updatedAt: now };
    if (draft.status === "active") {
      const issues = publishIssues({ ...draft, id: "new" });
      if (issues.length) return fail(AppErrors.validation(`Cannot publish yet: ${issues.join("; ")}`, { issues }));
    }
    const created = await repo.createPooja(draft);
    await audit("create", created, `Created pooja "${created.title}" (${created.status})`, actor);
    return ok(created);
  },

  async update(id: string, input: PoojaInput, actor: Actor): Promise<Result<Pooja>> {
    const repo = getPoojaRepository();
    const cur = await repo.getPooja(id);
    if (!cur) return fail(AppErrors.notFound("Pooja not found"));
    const slug = input.slug || cur.slug;
    if (slug !== cur.slug && (await repo.slugTaken(slug, id))) return fail(AppErrors.conflict("This URL is already used by another pooja"));
    if (input.category !== cur.category && !(await categoryExists(input.category))) return fail(AppErrors.validation("This category no longer exists. Choose another one.", [{ field: "category", message: "Choose a category" }]));
    // Bookings, links and reports depend on the type, so it is fixed once anyone has booked.
    if (input.type !== cur.type && (await repo.hasBookings(id))) {
      return fail(AppErrors.conflict(`This ${cur.type === "havan" ? "havan" : "pooja"} already has bookings, so its type cannot change. Create a new one instead.`, [{ field: "type", message: "Type cannot change after bookings" }]));
    }
    const next: Pooja = { ...cur, ...input, slug, updatedBy: actor.name, updatedAt: new Date().toISOString() };
    if (next.status === "active") {
      const issues = publishIssues(next);
      if (issues.length) return fail(AppErrors.validation(`Cannot publish yet: ${issues.join("; ")}`, { issues }));
    }
    const updated = await repo.updatePooja(id, next);
    if (!updated) return fail(AppErrors.notFound("Pooja not found"));
    const changes = [
      cur.status !== updated.status ? `status ${cur.status} → ${updated.status}` : "",
      JSON.stringify(cur.packages.map((p) => [p.id, p.price, p.active])) !== JSON.stringify(updated.packages.map((p) => [p.id, p.price, p.active])) ? "packages/prices" : "",
      JSON.stringify(cur.schedule) !== JSON.stringify(updated.schedule) ? "schedule" : "",
      JSON.stringify(cur.policy) !== JSON.stringify(updated.policy) ? "policy" : "",
      cur.slug !== updated.slug ? `URL /${cur.slug} → /${updated.slug}` : "",
    ].filter(Boolean);
    await audit(cur.status !== updated.status ? "status" : "update", updated, `Updated pooja "${updated.title}"${changes.length ? `: ${changes.join(", ")}` : ""}`, actor);
    return ok(updated);
  },

  async setStatus(id: string, status: PoojaStatus, actor: Actor): Promise<Result<Pooja>> {
    const repo = getPoojaRepository();
    const cur = await repo.getPooja(id);
    if (!cur) return fail(AppErrors.notFound("Pooja not found"));
    if (cur.status === status) return ok(cur);
    if (status === "active") {
      const issues = publishIssues(cur);
      if (issues.length) return fail(AppErrors.validation(`Cannot publish yet: ${issues.join("; ")}`, { issues }));
    }
    const updated = await repo.updatePooja(id, { status, updatedBy: actor.name, updatedAt: new Date().toISOString() });
    if (!updated) return fail(AppErrors.notFound("Pooja not found"));
    await audit("status", updated, `Pooja "${updated.title}" ${cur.status} → ${status}`, actor);
    return ok(updated);
  },

  async duplicate(id: string, actor: Actor): Promise<Result<Pooja>> {
    const repo = getPoojaRepository();
    const cur = await repo.getPooja(id);
    if (!cur) return fail(AppErrors.notFound("Pooja not found"));
    const now = new Date().toISOString();
    const { id: _i, ...rest } = cur;
    void _i;
    const copy = await repo.createPooja({ ...rest, title: `${cur.title} (copy)`, slug: await uniqueSlug(`${cur.slug}-copy`), status: "draft", featured: false, createdBy: actor.name, updatedBy: actor.name, createdAt: now, updatedAt: now });
    await audit("create", copy, `Duplicated "${cur.title}" as a draft`, actor);
    return ok(copy);
  },

  async remove(id: string, actor: Actor): Promise<Result<{ id: string }>> {
    const repo = getPoojaRepository();
    const cur = await repo.getPooja(id);
    if (!cur) return fail(AppErrors.notFound("Pooja not found"));
    if (await repo.hasBookings(id)) return fail(AppErrors.conflict("This pooja has bookings, so it cannot be deleted. Archive it instead."));
    await repo.deletePooja(id);
    await audit("delete", cur, `Deleted pooja "${cur.title}"`, actor);
    return ok({ id });
  },

  /** Slots with live capacity (admin view: includes closed and full slots). */
  async availability(id: string, from?: string, days = 30): Promise<Result<SlotView[]>> {
    const repo = getPoojaRepository();
    const p = await repo.getPooja(id);
    if (!p) return fail(AppErrors.notFound("Pooja not found"));
    return ok(buildSlots(p, Date.now(), await repo.slotUsage(id), { from, days: Math.min(Math.max(days, 1), 120) }));
  },

  /* ---------------- storefront (read only) ---------------- */
  async listPublic(): Promise<Pooja[]> {
    return (await getPoojaRepository().listPoojas()).filter((p) => p.status === "active");
  },
  async getPublic(slug: string): Promise<Result<Pooja>> {
    const p = await getPoojaRepository().getPoojaBySlug(slug);
    return p && p.status === "active" ? ok(p) : fail(AppErrors.notFound("Pooja not found"));
  },

  /**
   * Active poojas that customers can actually book (at least one active
   * package), in display order, without admin-only fields.
   */
  async listStorefront(type: RitualType = "pooja"): Promise<PublicPooja[]> {
    const rows = (await this.listPublic()).filter((p) => p.type === type);
    return rows
      .map(toPublic)
      .filter((p) => p.packages.length > 0)
      .sort((a, b) => Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  },
  async getStorefront(slug: string): Promise<Result<PublicPooja>> {
    const r = await this.getPublic(slug);
    if (!r.ok) return r;
    const p = toPublic(r.value);
    return p.packages.length ? ok(p) : fail(AppErrors.notFound("Pooja not found"));
  },

  /**
   * Cards + category chips for storefront pages. Never throws: on any
   * database problem it returns empty lists so the page still renders.
   */
  async storefrontCards(type: RitualType = "pooja"): Promise<{ poojas: (PublicPooja & { next: { date: string; time: string; label: string } | null })[]; categories: PublicPoojaCategory[] }> {
    try {
      const poojas = await this.listStorefront(type);
      if (!poojas.length) return { poojas: [], categories: [] };
      const [next, categories] = await Promise.all([this.nextOpen(poojas), poojaCategoryService.listStorefront(poojas)]);
      return {
        poojas: poojas.map((p) => {
          const s = next[p.id];
          return { ...p, next: s ? { date: s.date, time: s.time, label: s.label } : null };
        }),
        categories,
      };
    } catch {
      return { poojas: [], categories: [] };
    }
  },

  /** First open slot per pooja id (null when nothing is open in the window). */
  async nextOpen(poojas: Pick<PublicPooja, "id" | "schedule">[]): Promise<Record<string, SlotView | null>> {
    const repo = getPoojaRepository();
    const now = Date.now();
    const pairs = await Promise.all(poojas.map(async (p) => {
      try {
        const slot = buildSlots(p, now, await repo.slotUsage(p.id)).find((s) => !s.closed && s.left > 0) ?? null;
        return [p.id, slot] as const;
      } catch {
        return [p.id, null] as const;
      }
    }));
    return Object.fromEntries(pairs);
  },

  /** Open dates customers can pick: not past the cutoff and not full. */
  async openSlots(slug: string, days = 60): Promise<Result<SlotView[]>> {
    const repo = getPoojaRepository();
    const p = await repo.getPoojaBySlug(slug);
    if (!p || p.status !== "active") return fail(AppErrors.notFound("Pooja not found"));
    const all = buildSlots(p, Date.now(), await repo.slotUsage(p.id), { days: Math.min(Math.max(days, 1), 120) });
    return ok(all.filter((s) => !s.closed && s.left > 0).slice(0, 120));
  },
};

function toPublic(p: Pooja): PublicPooja {
  const { createdBy: _c, updatedBy: _u, policy, ...rest } = p;
  void _c; void _u;
  const packages = p.packages.filter((x) => x.active);
  const cheapest = [...packages].sort((a, b) => a.price - b.price)[0];
  return {
    ...rest,
    packages,
    addOns: p.addOns.filter((x) => x.active),
    policy: { freeRescheduleHours: policy.freeRescheduleHours, refundTiers: policy.refundTiers },
    priceFrom: cheapest?.price ?? 0,
    mrpFrom: cheapest?.mrp && cheapest.mrp > cheapest.price ? cheapest.mrp : null,
  };
}

/* ------------------------------------------------------------------ *
 * Categories
 *   key   stable id stored on poojas (never changes; renaming is safe)
 *   name  unique, case-insensitive
 *   slug  unique public URL part
 *   A category with poojas cannot be deleted: hide it or merge it.
 * ------------------------------------------------------------------ */
const keyify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50) || "category";
const catAudit = (action: "create" | "update" | "delete", c: { key: string; name: string }, summary: string, actor: Actor) =>
  auditService.record({ action, entity: "pooja", entityId: `category:${c.key}`, entityLabel: c.name, summary, actor: actor.name });

export const poojaCategoryService = {
  /** Visible categories that have at least one bookable pooja, in admin order. */
  async listStorefront(poojas: PublicPooja[]): Promise<PublicPoojaCategory[]> {
    const count = new Map<string, number>();
    for (const p of poojas) count.set(p.category, (count.get(p.category) ?? 0) + 1);
    const cats = await getPoojaRepository().listCategories();
    return cats
      .filter((c) => c.visible && (count.get(c.key) ?? 0) > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((c) => ({ key: c.key, name: c.name, slug: c.slug, icon: c.icon, count: count.get(c.key) ?? 0 }));
  },

  async list(): Promise<PoojaCategoryRow[]> {
    const repo = getPoojaRepository();
    const [cats, counts] = await Promise.all([repo.listCategories(), repo.categoryCounts()]);
    return cats.map((c) => ({ ...c, poojaCount: counts[c.key] ?? 0 }));
  },

  async create(input: CategoryCreateInput, actor: Actor): Promise<Result<PoojaCategoryItem>> {
    const repo = getPoojaRepository();
    const all = await repo.listCategories();
    if (all.length >= 200) return fail(AppErrors.validation("You can have at most 200 categories"));
    const name = input.name.trim().replace(/\s+/g, " ");
    let slug = input.slug || slugify(name);
    const clash = await repo.categoryClash(name, slug);
    if (clash === "name") return fail(AppErrors.conflict(`A category called "${name}" already exists`));
    if (clash === "slug") {
      if (input.slug) return fail(AppErrors.conflict("This URL is already used by another category"));
      for (let i = 2; (await repo.categoryClash(name, slug)) === "slug"; i++) slug = `${slugify(name).slice(0, 64)}-${i}`;
    }
    let key = keyify(name);
    for (let i = 2; all.some((c) => c.key === key); i++) key = `${keyify(name).slice(0, 46)}_${i}`;
    const now = new Date().toISOString();
    const created = await repo.createCategory({
      key, name, slug, icon: input.icon ?? "Flame", image: input.image ?? "", description: input.description ?? "",
      seo: input.seo ?? { title: "", description: "" }, visible: input.visible ?? true,
      sortOrder: all.reduce((m, c) => Math.max(m, c.sortOrder), 0) + 10, createdAt: now, updatedAt: now,
    });
    if (created === "duplicate") return fail(AppErrors.conflict("A category with this name or URL was just added. Reload and try again."));
    await catAudit("create", created, `Added pooja category "${created.name}"`, actor);
    return ok(created);
  },

  async update(key: string, input: CategoryUpdateInput, actor: Actor): Promise<Result<PoojaCategoryItem>> {
    const repo = getPoojaRepository();
    const cur = await repo.getCategory(key);
    if (!cur) return fail(AppErrors.notFound("Category not found"));
    const name = input.name.trim().replace(/\s+/g, " ");
    const clash = await repo.categoryClash(name, input.slug, key);
    if (clash === "name") return fail(AppErrors.conflict(`A category called "${name}" already exists`));
    if (clash === "slug") return fail(AppErrors.conflict("This URL is already used by another category"));
    const updated = await repo.updateCategory(key, { ...input, name, updatedAt: new Date().toISOString() });
    if (updated === "duplicate") return fail(AppErrors.conflict("A category with this name or URL already exists"));
    if (!updated) return fail(AppErrors.notFound("Category not found"));
    const changes = [cur.name !== updated.name ? `renamed "${cur.name}" → "${updated.name}"` : "", cur.slug !== updated.slug ? `URL ${cur.slug} → ${updated.slug}` : "", cur.visible !== updated.visible ? (updated.visible ? "shown" : "hidden") : ""].filter(Boolean);
    await catAudit("update", updated, `Updated pooja category "${updated.name}"${changes.length ? `: ${changes.join(", ")}` : ""}`, actor);
    return ok(updated);
  },

  async reorder(keys: string[], actor: Actor): Promise<Result<PoojaCategoryRow[]>> {
    const repo = getPoojaRepository();
    const all = await repo.listCategories();
    const known = new Set(all.map((c) => c.key));
    if (keys.length !== all.length || keys.some((k) => !known.has(k))) return fail(AppErrors.conflict("Categories changed while you were sorting. Reload and try again."));
    await repo.setCategoryOrder(keys);
    await auditService.record({ action: "update", entity: "pooja", entityId: "categories", entityLabel: "Pooja categories", summary: "Reordered pooja categories", actor: actor.name });
    return ok(await this.list());
  },

  async remove(key: string, actor: Actor): Promise<Result<{ key: string }>> {
    const repo = getPoojaRepository();
    const cur = await repo.getCategory(key);
    if (!cur) return fail(AppErrors.notFound("Category not found"));
    const n = (await repo.categoryCounts())[key] ?? 0;
    if (n > 0) return fail(AppErrors.conflict(`${n} pooja${n > 1 ? "s are" : " is"} in this category. Move them to another category (Merge) or hide it instead.`, { poojaCount: n }));
    if ((await repo.listCategories()).length <= 1) return fail(AppErrors.validation("Keep at least one category"));
    await repo.deleteCategory(key);
    await catAudit("delete", cur, `Deleted pooja category "${cur.name}"`, actor);
    return ok({ key });
  },

  /** Move every pooja into `into`, then delete this category. */
  async merge(key: string, into: string, actor: Actor): Promise<Result<{ moved: number; into: PoojaCategoryItem }>> {
    if (key === into) return fail(AppErrors.validation("Choose a different category to merge into"));
    const repo = getPoojaRepository();
    const [from, to] = await Promise.all([repo.getCategory(key), repo.getCategory(into)]);
    if (!from) return fail(AppErrors.notFound("Category not found"));
    if (!to) return fail(AppErrors.notFound("The target category no longer exists"));
    const moved = await repo.movePoojas(key, into);
    // A pooja saved into `key` during the move would be moved by a second pass.
    const late = await repo.movePoojas(key, into);
    await repo.deleteCategory(key);
    await catAudit("delete", from, `Merged pooja category "${from.name}" into "${to.name}" (${moved + late} poojas moved)`, actor);
    return ok({ moved: moved + late, into: to });
  },
};

export const panditService = {
  async list(): Promise<Pandit[]> { return getPoojaRepository().listPandits(); },

  async create(input: PanditInput, actor: Actor): Promise<Result<Pandit>> {
    const repo = getPoojaRepository();
    if (await repo.phoneTaken(input.phone)) return fail(AppErrors.conflict("A pandit with this mobile already exists"));
    const now = new Date().toISOString();
    const p = await repo.createPandit({ ...input, createdAt: now, updatedAt: now });
    await auditService.record({ action: "create", entity: "pooja", entityId: p.id, entityLabel: p.name, summary: `Added pandit ${p.name}`, actor: actor.name });
    return ok(p);
  },

  async update(id: string, input: PanditInput, actor: Actor): Promise<Result<Pandit>> {
    const repo = getPoojaRepository();
    const cur = await repo.getPandit(id);
    if (!cur) return fail(AppErrors.notFound("Pandit not found"));
    if (input.phone !== cur.phone && (await repo.phoneTaken(input.phone, id))) return fail(AppErrors.conflict("A pandit with this mobile already exists"));
    const p = await repo.updatePandit(id, { ...input, updatedAt: new Date().toISOString() });
    if (!p) return fail(AppErrors.notFound("Pandit not found"));
    await auditService.record({ action: "update", entity: "pooja", entityId: p.id, entityLabel: p.name, summary: `Updated pandit ${p.name}${cur.active !== p.active ? (p.active ? " (activated)" : " (deactivated)") : ""}`, actor: actor.name });
    return ok(p);
  },

  async remove(id: string, actor: Actor): Promise<Result<{ id: string }>> {
    const repo = getPoojaRepository();
    const cur = await repo.getPandit(id);
    if (!cur) return fail(AppErrors.notFound("Pandit not found"));
    if (await repo.panditHasOpenBookings(id)) return fail(AppErrors.conflict("This pandit has upcoming poojas. Reassign them first, or deactivate the pandit."));
    await repo.deletePandit(id);
    await auditService.record({ action: "delete", entity: "pooja", entityId: id, entityLabel: cur.name, summary: `Removed pandit ${cur.name}`, actor: actor.name });
    return ok({ id });
  },
};
