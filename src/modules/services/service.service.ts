/**
 * Services domain — service (business logic). Admin CRUD + the storefront
 * read helpers (active list, by-slug).
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import { auditService } from "@/modules/audit";
import type { AstroService } from "@/types";
import { getServiceRepository } from "./service.repository";
import type { CreateServiceDto, UpdateServiceDto } from "./service.schema";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const serviceService = {
  async list(): Promise<Result<AstroService[]>> {
    const repo = getServiceRepository();
    return ok(await repo.findAll());
  },

  async getById(id: string): Promise<Result<AstroService>> {
    const repo = getServiceRepository();
    const s = await repo.findById(id);
    if (!s) return fail(AppErrors.notFound("Service not found"));
    return ok(s);
  },

  async create(dto: CreateServiceDto): Promise<Result<AstroService>> {
    const repo = getServiceRepository();
    let slug = slugify(dto.title);
    if (await repo.findBySlug(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const all = await repo.findAll();
    const maxOrder = all.reduce((m, s) => Math.max(m, s.order ?? 0), 0);

    const service: AstroService = {
      id: newId("svc"),
      slug,
      title: dto.title.trim(),
      tagline: dto.tagline?.trim() || "",
      description: dto.description?.trim() || "",
      icon: dto.icon ?? "Sparkles",
      priceFrom: dto.priceFrom,
      duration: dto.duration?.trim() || "30 min",
      popular: dto.popular ?? false,
      features: (dto.features ?? []).filter((f) => f.trim()),
      status: dto.status ?? "active",
      order: dto.order ?? maxOrder + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const created = await repo.create(service);
    await auditService.record({
      action: "create",
      entity: "settings",
      entityId: created.id,
      entityLabel: created.title,
      summary: `Created service "${created.title}"`,
    });
    return ok(created);
  },

  async update(id: string, dto: UpdateServiceDto): Promise<Result<AstroService>> {
    const repo = getServiceRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Service not found"));

    const patch: Partial<AstroService> = {
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.tagline !== undefined && { tagline: dto.tagline }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.icon !== undefined && { icon: dto.icon }),
      ...(dto.priceFrom !== undefined && { priceFrom: dto.priceFrom }),
      ...(dto.duration !== undefined && dto.duration !== "" && { duration: dto.duration }),
      ...(dto.popular !== undefined && { popular: dto.popular }),
      ...(dto.features !== undefined && { features: dto.features.filter((f) => f.trim()) }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.order !== undefined && { order: dto.order }),
      updatedAt: new Date().toISOString(),
    };

    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Service not found"));
    await auditService.record({
      action: "update",
      entity: "settings",
      entityId: updated.id,
      entityLabel: updated.title,
      summary: `Updated service "${updated.title}"`,
    });
    return ok(updated);
  },

  async remove(id: string): Promise<Result<{ id: string }>> {
    const repo = getServiceRepository();
    const existing = await repo.findById(id);
    const removed = await repo.remove(id);
    if (!removed) return fail(AppErrors.notFound("Service not found"));
    await auditService.record({
      action: "delete",
      entity: "settings",
      entityId: id,
      entityLabel: existing?.title,
      summary: `Deleted service "${existing?.title ?? id}"`,
    });
    return ok({ id });
  },

  /* ---------------- storefront ---------------- */
  async listActive(): Promise<Result<AstroService[]>> {
    const repo = getServiceRepository();
    const all = await repo.findAll();
    return ok(all.filter((s) => s.status === "active"));
  },

  async getActiveBySlug(slug: string): Promise<Result<AstroService>> {
    const repo = getServiceRepository();
    const s = await repo.findBySlug(slug);
    if (!s || s.status !== "active") return fail(AppErrors.notFound("Service not found"));
    return ok(s);
  },
};
