/**
 * Reviews domain — service. Customers create reviews (pending); admins
 * moderate (approve/reject) and reply. Approved reviews recompute the
 * product's visible rating + review count.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import { productService } from "@/modules/products";
import { auditService } from "@/modules/audit";
import { getReviewRepository } from "./review.repository";
import type { Review } from "./review.types";
import type { CreateReviewDto, UpdateReviewDto } from "./review.schema";

/** Recompute and persist a product's rating + count from approved reviews. */
async function recomputeProductRating(productId: string): Promise<void> {
  const repo = getReviewRepository();
  const approved = (await repo.findByProduct(productId)).filter((r) => r.status === "approved");
  const count = approved.length;
  const avg = count ? approved.reduce((s, r) => s + r.rating, 0) / count : 0;
  await productService.setRating(productId, avg, count);
}

export const reviewService = {
  async list(): Promise<Result<Review[]>> {
    const repo = getReviewRepository();
    const all = await repo.findAll();
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return ok(all);
  },

  async getById(id: string): Promise<Result<Review>> {
    const repo = getReviewRepository();
    const r = await repo.findById(id);
    if (!r) return fail(AppErrors.notFound("Review not found"));
    return ok(r);
  },

  async create(dto: CreateReviewDto): Promise<Result<Review>> {
    const repo = getReviewRepository();
    const pRes = await productService.getById(dto.productId);
    if (!pRes.ok) return fail(AppErrors.validation("Product not found"));
    const p = pRes.value;

    const now = new Date().toISOString();
    const review: Review = {
      id: newId("rev"),
      productId: p.id,
      productName: p.name,
      productImage: p.image,
      authorName: dto.authorName.trim(),
      authorEmail: dto.authorEmail || undefined,
      rating: dto.rating,
      title: dto.title?.trim() || undefined,
      body: dto.body.trim(),
      verified: false,
      status: "pending", // all new reviews await moderation
      createdAt: now,
      updatedAt: now,
    };
    return ok(await repo.create(review));
  },

  async update(id: string, dto: UpdateReviewDto): Promise<Result<Review>> {
    const repo = getReviewRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Review not found"));

    const patch: Partial<Review> = {
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.reply !== undefined && { reply: dto.reply || undefined }),
      updatedAt: new Date().toISOString(),
    };

    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Review not found"));

    // if the approval state changed, recompute the product's rating
    if (dto.status !== undefined && dto.status !== existing.status) {
      await recomputeProductRating(updated.productId);
      await auditService.record({
        action: "status",
        entity: "review",
        entityId: updated.id,
        entityLabel: updated.productName,
        summary: `Review by ${updated.authorName} ${updated.status}`,
      });
    }
    return ok(updated);
  },

  async remove(id: string): Promise<Result<{ id: string }>> {
    const repo = getReviewRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Review not found"));
    const removed = await repo.remove(id);
    if (!removed) return fail(AppErrors.notFound("Review not found"));
    if (existing.status === "approved") await recomputeProductRating(existing.productId);
    return ok({ id });
  },

  /* ---------------- storefront ---------------- */
  async approvedForProduct(productId: string): Promise<Result<Review[]>> {
    const repo = getReviewRepository();
    const list = (await repo.findByProduct(productId)).filter((r) => r.status === "approved");
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return ok(list);
  },
};
