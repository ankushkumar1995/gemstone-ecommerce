/**
 * Collections domain — service (business logic).
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import type { Collection } from "@/types";
import { getCollectionRepository } from "./collection.repository";
import type { CreateCollectionDto, UpdateCollectionDto } from "./collection.schema";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const collectionService = {
  async list(): Promise<Result<Collection[]>> {
    const repo = getCollectionRepository();
    return ok(await repo.findAll());
  },

  async getById(id: string): Promise<Result<Collection>> {
    const repo = getCollectionRepository();
    const c = await repo.findById(id);
    if (!c) return fail(AppErrors.notFound("Collection not found"));
    return ok(c);
  },

  async create(dto: CreateCollectionDto): Promise<Result<Collection>> {
    const repo = getCollectionRepository();
    let slug = slugify(dto.title);
    if (await repo.findBySlug(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const collection: Collection = {
      id: newId("col"),
      slug,
      title: dto.title.trim(),
      description: dto.description?.trim() || undefined,
      image: dto.image?.trim() || undefined,
      featured: dto.featured ?? false,
      createdAt: new Date().toISOString(),
    };
    return ok(await repo.create(collection));
  },

  async update(id: string, dto: UpdateCollectionDto): Promise<Result<Collection>> {
    const repo = getCollectionRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Collection not found"));

    const patch: Partial<Collection> = {
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.description !== undefined && { description: dto.description || undefined }),
      ...(dto.image !== undefined && { image: dto.image || undefined }),
      ...(dto.featured !== undefined && { featured: dto.featured }),
    };

    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Collection not found"));
    return ok(updated);
  },

  async remove(id: string): Promise<Result<{ id: string }>> {
    const repo = getCollectionRepository();
    const removed = await repo.remove(id);
    if (!removed) return fail(AppErrors.notFound("Collection not found"));
    return ok({ id });
  },
};
