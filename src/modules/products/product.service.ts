/**
 * Products domain — service (business logic). Assembles complete Product
 * records from admin input, applies defaults, generates slugs/ids, and talks
 * to the repository. Returns Result<T>.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import { auditService } from "@/modules/audit";
import type { Product, ProductActivity } from "@/types";
import { getProductRepository } from "./product.repository";
import type { CreateProductDto, UpdateProductDto } from "./product.schema";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function logEntry(
  type: ProductActivity["type"],
  message: string
): ProductActivity {
  return { id: newId("act"), at: new Date().toISOString(), type, message, actor: "Admin" };
}

/** Normalise the optional content/videos arrays with stable ids. */
function withIds<T extends { id?: string }>(items: T[] | undefined, prefix: string) {
  return (items ?? []).map((it) => ({ ...it, id: it.id ?? newId(prefix) }));
}

const DEFAULT_GRADIENT =
  "linear-gradient(135deg, #e6b43a 0%, #9169ff 55%, #2a1d5e 120%)";
const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1611425143678-08fc480cafde?auto=format&fit=crop&w=900&q=80";

export const productService = {
  async list(): Promise<Result<Product[]>> {
    const repo = getProductRepository();
    await this.runScheduledPublish();
    return ok(await repo.findAll());
  },

  async getById(id: string): Promise<Result<Product>> {
    const repo = getProductRepository();
    const p = await repo.findById(id);
    if (!p) return fail(AppErrors.notFound("Product not found"));
    return ok(p);
  },

  /**
   * Set a product's visible rating + review count. Called by the reviews
   * module after moderation so the catalogue reflects approved reviews.
   */
  async setRating(id: string, rating: number, reviews: number): Promise<Result<Product>> {
    const repo = getProductRepository();
    const updated = await repo.update(id, {
      rating: Math.round(rating * 10) / 10,
      reviews,
    });
    if (!updated) return fail(AppErrors.notFound("Product not found"));
    return ok(updated);
  },

  /**
   * Adjust stock for a product (and optionally a specific variant). Used by
   * the orders module: negative delta on order confirm, positive on
   * cancel/refund (restock). Clamps at 0, keeps `inStock` in sync, logs it.
   */
  async adjustStock(
    id: string,
    delta: number,
    opts?: { variantId?: string; reason?: string }
  ): Promise<Result<Product>> {
    const repo = getProductRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Product not found"));

    const patch: Partial<Product> = {};

    if (opts?.variantId && existing.variants?.length) {
      patch.variants = existing.variants.map((v) =>
        v.id === opts.variantId ? { ...v, stockQty: Math.max(0, v.stockQty + delta) } : v
      );
      // product-level stock mirrors the sum of variant stock
      const total = patch.variants.reduce((s, v) => s + v.stockQty, 0);
      patch.stockQty = total;
      patch.inStock = total > 0;
    } else {
      const next = Math.max(0, (existing.stockQty ?? 0) + delta);
      patch.stockQty = next;
      patch.inStock = next > 0;
    }

    const verb = delta < 0 ? "decremented" : "restocked";
    patch.activity = [
      logEntry("stock", `Stock ${verb} by ${Math.abs(delta)}${opts?.reason ? ` (${opts.reason})` : ""}`),
      ...(existing.activity ?? []),
    ].slice(0, 50);

    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Product not found"));
    return ok(updated);
  },

  async create(dto: CreateProductDto): Promise<Result<Product>> {
    const repo = getProductRepository();

    // ensure unique slug
    let slug = slugify(dto.name);
    if (await repo.findBySlug(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const product: Product = {
      id: newId("p"),
      slug,
      name: dto.name.trim(),
      category: dto.category,
      price: dto.price,
      mrp: dto.mrp || dto.price,
      rating: 0,
      reviews: 0,
      image: dto.image?.trim() || PLACEHOLDER_IMAGE,
      gradient: DEFAULT_GRADIENT,
      zodiac: dto.zodiac ?? [],
      badge: dto.badge,
      shortDescription: dto.shortDescription?.trim() || "",
      attributes: {
        stone: dto.attributes?.stone?.trim() || dto.name.trim(),
        planet: dto.attributes?.planet ?? "Jupiter",
        benefits: dto.attributes?.benefits ?? [],
        origin: dto.attributes?.origin?.trim() || "—",
        weightCarat: dto.attributes?.weightCarat ?? 0,
        certification: dto.attributes?.certification?.trim() || "Lab Certified",
        color: dto.attributes?.color?.trim() || "—",
      },
      inStock: dto.inStock ?? (dto.stockQty === undefined ? true : dto.stockQty > 0),
      status: dto.status ?? "active",
      stockQty: dto.stockQty ?? 0,
      sku: dto.sku?.trim() || undefined,
      tags: dto.tags ?? [],
      images: dto.images ?? (dto.image ? [dto.image.trim()] : []),
      variants: (dto.variants ?? []).map((v) => ({
        id: v.id ?? newId("v"),
        label: v.label,
        price: v.price,
        stockQty: v.stockQty,
        sku: v.sku || undefined,
      })),

      /* workflow */
      publishAt: dto.publishAt || undefined,
      activity: [
        ...(dto.publishAt ? [logEntry("scheduled", `Scheduled to publish on ${new Date(dto.publishAt).toLocaleString()}`)] : []),
        logEntry("created", "Product created"),
      ],

      /* SEO & content */
      seo: dto.seo
        ? {
            metaTitle: dto.seo.metaTitle || undefined,
            metaDescription: dto.seo.metaDescription || undefined,
            ogImage: dto.seo.ogImage || undefined,
            keywords: dto.seo.keywords ?? [],
            noindex: dto.seo.noindex ?? false,
          }
        : undefined,
      content: withIds(dto.content, "sec"),

      /* media extensions */
      videos: withIds(dto.videos, "vid").map((v) => ({ ...v, label: v.label || undefined })),
      certificatePdf: dto.certificatePdf || undefined,

      /* organisation */
      collections: dto.collections ?? [],
      related: dto.related ?? [],
      featured: dto.featured ?? false,
    };

    const createdProduct = await repo.create(product);
    await auditService.record({
      action: "create",
      entity: "product",
      entityId: createdProduct.id,
      entityLabel: createdProduct.name,
      summary: `Created product "${createdProduct.name}"`,
    });
    return ok(createdProduct);
  },

  async update(id: string, dto: UpdateProductDto): Promise<Result<Product>> {
    const repo = getProductRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Product not found"));

    const patch: Partial<Product> = {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.mrp !== undefined && { mrp: dto.mrp }),
      ...(dto.image !== undefined && dto.image !== "" && { image: dto.image.trim() }),
      ...(dto.images !== undefined && {
        images: dto.images,
        ...(dto.images[0] && { image: dto.images[0] }),
      }),
      ...(dto.shortDescription !== undefined && { shortDescription: dto.shortDescription.trim() }),
      ...(dto.badge !== undefined && { badge: dto.badge }),
      ...(dto.inStock !== undefined && { inStock: dto.inStock }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.stockQty !== undefined && { stockQty: dto.stockQty, inStock: dto.stockQty > 0 }),
      ...(dto.sku !== undefined && { sku: dto.sku || undefined }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
      ...(dto.variants !== undefined && {
        variants: dto.variants.map((v) => ({
          id: v.id ?? newId("v"),
          label: v.label,
          price: v.price,
          stockQty: v.stockQty,
          sku: v.sku || undefined,
        })),
      }),
      ...(dto.zodiac !== undefined && { zodiac: dto.zodiac }),
      ...(dto.attributes !== undefined && {
        attributes: {
          ...existing.attributes,
          ...Object.fromEntries(
            Object.entries(dto.attributes).filter(([, v]) => v !== undefined && v !== "")
          ),
        },
      }),

      /* workflow */
      ...(dto.publishAt !== undefined && { publishAt: dto.publishAt || undefined }),

      /* SEO & content */
      ...(dto.seo !== undefined && {
        seo: {
          metaTitle: dto.seo.metaTitle || undefined,
          metaDescription: dto.seo.metaDescription || undefined,
          ogImage: dto.seo.ogImage || undefined,
          keywords: dto.seo.keywords ?? existing.seo?.keywords ?? [],
          noindex: dto.seo.noindex ?? existing.seo?.noindex ?? false,
        },
      }),
      ...(dto.content !== undefined && { content: withIds(dto.content, "sec") }),

      /* media extensions */
      ...(dto.videos !== undefined && {
        videos: withIds(dto.videos, "vid").map((v) => ({ ...v, label: v.label || undefined })),
      }),
      ...(dto.certificatePdf !== undefined && { certificatePdf: dto.certificatePdf || undefined }),

      /* organisation */
      ...(dto.collections !== undefined && { collections: dto.collections }),
      ...(dto.related !== undefined && { related: dto.related }),
      ...(dto.featured !== undefined && { featured: dto.featured }),
    };

    // ---- build activity entries from what actually changed ----
    const entries: ProductActivity[] = [];
    if (dto.status !== undefined && dto.status !== existing.status) {
      entries.push(
        logEntry(
          dto.status === "active" ? "published" : "status",
          `Status changed from "${existing.status ?? "active"}" to "${dto.status}"`
        )
      );
    }
    if (dto.price !== undefined && dto.price !== existing.price) {
      entries.push(logEntry("price", `Price changed from ₹${existing.price} to ₹${dto.price}`));
    }
    if (dto.stockQty !== undefined && dto.stockQty !== existing.stockQty) {
      entries.push(logEntry("stock", `Stock changed from ${existing.stockQty ?? 0} to ${dto.stockQty}`));
    }
    if (dto.publishAt !== undefined && (dto.publishAt || undefined) !== existing.publishAt) {
      entries.push(
        dto.publishAt
          ? logEntry("scheduled", `Publish scheduled for ${new Date(dto.publishAt).toLocaleString()}`)
          : logEntry("note", "Scheduled publish cleared")
      );
    }
    if (entries.length === 0) entries.push(logEntry("updated", "Product details updated"));

    patch.activity = [...entries, ...(existing.activity ?? [])].slice(0, 50);

    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Product not found"));
    await auditService.record({
      action: "update",
      entity: "product",
      entityId: updated.id,
      entityLabel: updated.name,
      summary: `Updated product "${updated.name}"`,
    });
    return ok(updated);
  },

  /**
   * Scheduled-publish sweep. Flips any product whose `publishAt` is in the
   * past and is still draft/review into "active". Called on product list.
   * In a real system this would be a cron job / queue worker.
   */
  async runScheduledPublish(): Promise<void> {
    const repo = getProductRepository();
    const all = await repo.findAll();
    const now = Date.now();
    for (const p of all) {
      if (
        p.publishAt &&
        (p.status === "draft" || p.status === "review") &&
        new Date(p.publishAt).getTime() <= now
      ) {
        await repo.update(p.id, {
          status: "active",
          publishAt: undefined,
          activity: [
            logEntry("published", "Auto-published (scheduled time reached)"),
            ...(p.activity ?? []),
          ].slice(0, 50),
        });
      }
    }
  },

  async remove(id: string): Promise<Result<{ id: string }>> {
    const repo = getProductRepository();
    const existing = await repo.findById(id);
    const okRemoved = await repo.remove(id);
    if (!okRemoved) return fail(AppErrors.notFound("Product not found"));
    await auditService.record({
      action: "delete",
      entity: "product",
      entityId: id,
      entityLabel: existing?.name,
      summary: `Deleted product "${existing?.name ?? id}"`,
    });
    return ok({ id });
  },
};
