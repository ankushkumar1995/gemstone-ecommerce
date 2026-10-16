/**
 * Products domain — service (business logic). Assembles complete Product
 * records from admin input, applies defaults, generates slugs/ids, and talks
 * to the repository. Returns Result<T>.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import { cache } from "@/core/cache";
import { paginate, type ListParams, type Paginated } from "@/core/query";
import { auditService } from "@/modules/audit";
import type { Product, ProductActivity } from "@/types";
import { getProductRepository } from "./product.repository";
import type {
  CreateProductDto,
  UpdateProductDto,
  AdjustStockDto,
  BulkProductDto,
  BulkPriceDto,
  AddVariantDto,
  UpdateVariantDto,
} from "./product.schema";
import type { FullVariant } from "./product.repository";
import type { ProductLifecycle, ProductSearchFilters, StockStatus } from "./product.types";

/** Cache keys for this module (invalidated on any write). */
const CACHE_TTL = 60; // seconds

function invalidate() {
  cache.delByPrefix("products:");
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Build a stable, readable SKU from the product name + a short random tail. */
function generateSku(name: string): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12)
    .replace(/-+$/g, "");
  const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base || "PRD"}-${tail}`;
}

/** Derive the admin stock status from quantity + thresholds. */
function deriveStockStatus(p: Pick<Product, "stockQty" | "lowStockThreshold" | "allowBackorder">): StockStatus {
  const qty = p.stockQty ?? 0;
  const low = p.lowStockThreshold ?? 3;
  if (qty <= 0) return p.allowBackorder ? "backorder" : "out_of_stock";
  if (qty <= low) return "low_stock";
  return "in_stock";
}

function logEntry(
  type: ProductActivity["type"],
  message: string
): ProductActivity {
  return { id: newId("act"), at: new Date().toISOString(), type, message, actor: "Admin" };
}

/** Human-readable summary of a bulk price change, for logs/audit. */
function describePriceMode(dto: BulkPriceDto): string {
  if (dto.mode === "set") return `set to ₹${dto.value}`;
  if (dto.mode === "percent") return `${dto.value >= 0 ? "+" : ""}${dto.value}%`;
  return `${dto.value >= 0 ? "+" : ""}₹${dto.value}`;
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

  /** Soft-deleted products, for the admin trash / restore view. */
  async listDeleted(): Promise<Result<Product[]>> {
    const repo = getProductRepository();
    return ok(await repo.findDeleted());
  },

  /**
   * Low / out-of-stock report for restocking. Each product is judged against
   * its OWN lowStockThreshold. `outOnly` narrows to fully out-of-stock items.
   */
  async listLowStock(opts?: { outOnly?: boolean }): Promise<Result<Product[]>> {
    const repo = getProductRepository();
    return ok(await repo.findLowStock(opts));
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
      ratingAvg: Math.round(rating * 10) / 10,
      ratingCount: reviews,
    });
    if (!updated) return fail(AppErrors.notFound("Product not found"));
    invalidate();
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
    invalidate();
    return ok(updated);
  },

  async create(dto: CreateProductDto): Promise<Result<Product>> {
    const repo = getProductRepository();

    // ensure unique slug
    let slug = slugify(dto.name);
    if (await repo.findBySlug(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    // ensure unique SKU: use the provided one (guarded) or auto-generate.
    let sku = dto.sku?.trim().toUpperCase() || generateSku(dto.name);
    if (await repo.skuTakenBy(sku)) {
      if (dto.sku?.trim()) {
        return fail(AppErrors.conflict(`A product with SKU "${sku}" already exists`));
      }
      // regenerate until unique (auto path)
      let guard = 0;
      do {
        sku = generateSku(dto.name);
        guard += 1;
      } while ((await repo.skuTakenBy(sku)) && guard < 5);
    }

    const product: Product = {
      id: newId("p"),
      slug,
      sku,
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
      tags: dto.tags ?? [],
      images: dto.images ?? (dto.image ? [dto.image.trim()] : []),
      imageAlts: dto.imageAlts ?? {},
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

      /* production catalogue surface */
      coverImage: dto.coverImage?.trim() || dto.image?.trim() || PLACEHOLDER_IMAGE,
      subtitle: dto.subtitle?.trim() || undefined,
      brand: dto.brand?.trim() || undefined,
      categoryId: dto.categoryId?.trim() || null,
      collectionIds: dto.collectionIds ?? dto.collections ?? [],
      relatedIds: dto.relatedIds ?? dto.related ?? [],
      currency: dto.currency?.trim().toUpperCase() || "INR",
      costPrice: dto.costPrice,
      taxClass: dto.taxClass ?? "gst_3",
      hsnCode: dto.hsnCode?.trim() || undefined,
      hasVariants: dto.hasVariants ?? ((dto.fullVariants?.length ?? 0) > 0),
      options: dto.options ?? [],
      fullVariants: (dto.fullVariants ?? []).map((v) => ({
        sku: v.sku || undefined,
        optionValues: v.optionValues ?? {},
        price: v.price,
        mrp: v.mrp,
        stockQty: v.stockQty ?? 0,
        weightGram: v.weightGram,
        barcode: v.barcode || undefined,
        image: v.image || undefined,
        isDefault: v.isDefault,
        active: v.active ?? true,
      })),
      trackInventory: dto.trackInventory ?? true,
      lowStockThreshold: dto.lowStockThreshold ?? 3,
      allowBackorder: dto.allowBackorder ?? false,
      warehouseLocation: dto.warehouseLocation?.trim() || undefined,
      description: dto.description?.trim() || undefined,
      specifications: (dto.specifications ?? []).map((s) => ({ label: s.label, value: s.value || undefined })),
      faqs: (dto.faqs ?? []).map((f) => ({ q: f.q, a: f.a || undefined })),
      weightGram: dto.weightGram,
      dimensions: dto.dimensions,
      shippingClass: dto.shippingClass ?? "standard",
      makingCharges: dto.makingCharges,
      gemstone: dto.attributes
        ? {
            stone: dto.attributes.stone?.trim() || undefined,
            planet: dto.attributes.planet,
            benefits: dto.attributes.benefits ?? [],
            origin: dto.attributes.origin?.trim() || undefined,
            weightCarat: dto.attributes.weightCarat,
            certification: dto.attributes.certification?.trim() || undefined,
            color: dto.attributes.color?.trim() || undefined,
            clarity: dto.attributes.clarity?.trim() || undefined,
            cut: dto.attributes.cut?.trim() || undefined,
            treatment: dto.attributes.treatment?.trim() || undefined,
            labName: dto.attributes.labName?.trim() || undefined,
            certificateNumber: dto.attributes.certificateNumber?.trim() || undefined,
          }
        : undefined,
      bestseller: dto.bestseller ?? false,
      displayOrder: dto.displayOrder ?? 0,
      ratingAvg: 0,
      ratingCount: 0,
      soldCount: 0,
      viewCount: 0,
    };
    product.stockStatus = deriveStockStatus(product);

    const createdProduct = await repo.create(product);
    invalidate();
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
      ...(dto.imageAlts !== undefined && { imageAlts: dto.imageAlts }),
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

      /* production catalogue surface */
      ...(dto.subtitle !== undefined && { subtitle: dto.subtitle || undefined }),
      ...(dto.brand !== undefined && { brand: dto.brand || undefined }),
      ...(dto.categoryId !== undefined && { categoryId: dto.categoryId || null }),
      ...(dto.collectionIds !== undefined && { collectionIds: dto.collectionIds }),
      ...(dto.relatedIds !== undefined && { relatedIds: dto.relatedIds }),
      ...(dto.currency !== undefined && dto.currency !== "" && { currency: dto.currency.toUpperCase() }),
      ...(dto.costPrice !== undefined && { costPrice: dto.costPrice }),
      ...(dto.taxClass !== undefined && { taxClass: dto.taxClass }),
      ...(dto.hsnCode !== undefined && { hsnCode: dto.hsnCode || undefined }),
      ...(dto.hasVariants !== undefined && { hasVariants: dto.hasVariants }),
      ...(dto.options !== undefined && { options: dto.options }),
      ...(dto.fullVariants !== undefined && {
        fullVariants: dto.fullVariants.map((v) => ({
          sku: v.sku || undefined,
          optionValues: v.optionValues ?? {},
          price: v.price,
          mrp: v.mrp,
          stockQty: v.stockQty ?? 0,
          weightGram: v.weightGram,
          barcode: v.barcode || undefined,
          image: v.image || undefined,
          isDefault: v.isDefault,
          active: v.active ?? true,
        })),
      }),
      ...(dto.trackInventory !== undefined && { trackInventory: dto.trackInventory }),
      ...(dto.lowStockThreshold !== undefined && { lowStockThreshold: dto.lowStockThreshold }),
      ...(dto.allowBackorder !== undefined && { allowBackorder: dto.allowBackorder }),
      ...(dto.warehouseLocation !== undefined && { warehouseLocation: dto.warehouseLocation || undefined }),
      ...(dto.coverImage !== undefined && dto.coverImage !== "" && { coverImage: dto.coverImage.trim(), image: dto.coverImage.trim() }),
      ...(dto.description !== undefined && { description: dto.description || undefined }),
      ...(dto.specifications !== undefined && {
        specifications: dto.specifications.map((s) => ({ label: s.label, value: s.value || undefined })),
      }),
      ...(dto.faqs !== undefined && { faqs: dto.faqs.map((f) => ({ q: f.q, a: f.a || undefined })) }),
      ...(dto.weightGram !== undefined && { weightGram: dto.weightGram }),
      ...(dto.dimensions !== undefined && { dimensions: dto.dimensions }),
      ...(dto.shippingClass !== undefined && { shippingClass: dto.shippingClass }),
      ...(dto.makingCharges !== undefined && { makingCharges: dto.makingCharges }),
      ...(dto.bestseller !== undefined && { bestseller: dto.bestseller }),
      ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
      ...(dto.attributes !== undefined && {
        gemstone: {
          ...existing.gemstone,
          ...Object.fromEntries(
            Object.entries(dto.attributes).filter(([, v]) => v !== undefined && v !== ""),
          ),
        },
      }),
    };

    // Prune alt-text entries whose image is no longer in the gallery, so the
    // imageAlts map never carries dangling keys after a reorder/remove.
    if (patch.images !== undefined || patch.imageAlts !== undefined) {
      const finalImages = patch.images ?? existing.images ?? [];
      const sourceAlts = patch.imageAlts ?? existing.imageAlts ?? {};
      const pruned: Record<string, string> = {};
      for (const url of finalImages) {
        const alt = sourceAlts[url];
        if (alt && alt.trim()) pruned[url] = alt.trim();
      }
      patch.imageAlts = pruned;
    }

    // SKU uniqueness guard (only when explicitly changed).
    if (dto.sku !== undefined && dto.sku.trim()) {
      const nextSku = dto.sku.trim().toUpperCase();
      if (nextSku !== (existing.sku ?? "").toUpperCase() && (await repo.skuTakenBy(nextSku, id))) {
        return fail(AppErrors.conflict(`A product with SKU "${nextSku}" already exists`));
      }
      patch.sku = nextSku;
    }

    // Keep the derived stock status in sync when stock-affecting fields change.
    if (dto.stockQty !== undefined || dto.lowStockThreshold !== undefined || dto.allowBackorder !== undefined) {
      patch.stockStatus = deriveStockStatus({
        stockQty: patch.stockQty ?? existing.stockQty,
        lowStockThreshold: patch.lowStockThreshold ?? existing.lowStockThreshold,
        allowBackorder: patch.allowBackorder ?? existing.allowBackorder,
      });
    }

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
    invalidate();
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
    invalidate();
    await auditService.record({
      action: "delete",
      entity: "product",
      entityId: id,
      entityLabel: existing?.name,
      summary: `Deleted product "${existing?.name ?? id}"`,
    });
    return ok({ id });
  },

  /* ---------------------------------------------------------------- *
   * Production additions: paginated listing, slug lookup, status,
   * restore, duplicate, API-facing stock adjust, bulk actions.
   * ---------------------------------------------------------------- */

  /** Paginated + searchable + filterable listing for the admin table. */
  async listPaginated(
    params: ListParams,
    filters?: ProductSearchFilters,
  ): Promise<Result<Paginated<Product>>> {
    const repo = getProductRepository();
    const key = `products:page:${params.page}:${params.limit}:${JSON.stringify(params.sort)}:${params.q ?? ""}:${JSON.stringify(filters ?? {})}`;
    const result = await cache.wrap(key, CACHE_TTL, async () => {
      const { items, total } = await repo.search({
        skip: params.skip,
        limit: params.limit,
        sort: params.sort,
        q: params.q,
        filters,
      });
      return paginate(items, total, params);
    });
    return ok(result);
  },

  /** Storefront lookup by slug (e.g. /product/royal-ruby-signet-ring). */
  async getBySlug(slug: string): Promise<Result<Product>> {
    const repo = getProductRepository();
    const key = `products:slug:${slug}`;
    const p = await cache.wrap(key, CACHE_TTL, () => repo.findBySlug(slug));
    if (!p) return fail(AppErrors.notFound("Product not found"));
    return ok(p);
  },

  /* ---------------------------------------------------------------- *
   * Storefront-facing reads (ACTIVE products only). Draft / archived
   * products are never shown to customers. Mirrors blog/services.
   * ---------------------------------------------------------------- */

  /** A single ACTIVE product by slug (storefront PDP). 404 for draft/archived. */
  async getActiveBySlug(slug: string): Promise<Result<Product>> {
    const repo = getProductRepository();
    const p = await repo.findBySlug(slug);
    if (!p || (p.status ?? "active") !== "active") {
      return fail(AppErrors.notFound("Product not found"));
    }
    return ok(p);
  },

  /** All ACTIVE products (storefront shop / sections). Ordered by displayOrder. */
  async listActive(): Promise<Result<Product[]>> {
    const repo = getProductRepository();
    const all = await repo.findAll();
    return ok(all.filter((p) => (p.status ?? "active") === "active"));
  },

  /**
   * Related ACTIVE products for a PDP — same category first, then others,
   * excluding the current slug. Falls back to any active products.
   */
  async relatedActive(slug: string, limit = 4): Promise<Result<Product[]>> {
    const repo = getProductRepository();
    const all = (await repo.findAll()).filter((p) => (p.status ?? "active") === "active");
    const current = all.find((p) => p.slug === slug);
    if (!current) return ok(all.filter((p) => p.slug !== slug).slice(0, limit));
    const same = all.filter((p) => p.slug !== slug && p.category === current.category);
    const others = all.filter((p) => p.slug !== slug && p.category !== current.category);
    return ok([...same, ...others].slice(0, limit));
  },

  /** Featured ACTIVE products (homepage). Falls back to top-rated. */
  async listFeatured(limit = 8): Promise<Result<Product[]>> {
    const repo = getProductRepository();
    const all = (await repo.findAll()).filter((p) => (p.status ?? "active") === "active");
    const featured = all.filter((p) => p.featured);
    const pool = featured.length >= limit ? featured : [...featured, ...all.filter((p) => !p.featured)];
    return ok(pool.slice(0, limit));
  },

  /** Set lifecycle status without touching other fields. */
  async setStatus(id: string, status: ProductLifecycle): Promise<Result<Product>> {
    const repo = getProductRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Product not found"));
    const updated = await repo.update(id, {
      status,
      activity: [
        logEntry(status === "active" ? "published" : "status", `Status set to "${status}"`),
        ...(existing.activity ?? []),
      ].slice(0, 50),
    });
    if (!updated) return fail(AppErrors.notFound("Product not found"));
    invalidate();
    await auditService.record({
      action: "status",
      entity: "product",
      entityId: id,
      entityLabel: updated.name,
      summary: `Set product "${updated.name}" status to "${status}"`,
    });
    return ok(updated);
  },

  /** Undo a soft delete. */
  async restore(id: string): Promise<Result<Product>> {
    const repo = getProductRepository();
    const restored = await repo.restore(id);
    if (!restored) return fail(AppErrors.notFound("Deleted product not found"));
    invalidate();
    await auditService.record({
      action: "update",
      entity: "product",
      entityId: id,
      entityLabel: restored.name,
      summary: `Restored product "${restored.name}"`,
    });
    return ok(restored);
  },

  /**
   * API-facing inventory adjust: either bump by `delta` or hard-`set` to an
   * absolute value, optionally for a specific variant SKU. Logs + audits.
   */
  async adjustStockApi(id: string, dto: AdjustStockDto): Promise<Result<Product>> {
    const repo = getProductRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Product not found"));

    const patch: Partial<Product> = {};
    const variantSku = dto.variantSku?.trim();

    if (variantSku && existing.fullVariants?.length) {
      const variants = existing.fullVariants.map((v) =>
        v.sku === variantSku
          ? { ...v, stockQty: dto.set !== undefined ? dto.set : Math.max(0, v.stockQty + (dto.delta ?? 0)) }
          : v,
      );
      patch.fullVariants = variants;
      const total = variants.reduce((s, v) => s + v.stockQty, 0);
      patch.stockQty = total;
      patch.inStock = total > 0;
    } else {
      const next = dto.set !== undefined ? dto.set : Math.max(0, (existing.stockQty ?? 0) + (dto.delta ?? 0));
      patch.stockQty = next;
      patch.inStock = next > 0;
    }

    patch.stockStatus = deriveStockStatus({
      stockQty: patch.stockQty ?? existing.stockQty,
      lowStockThreshold: existing.lowStockThreshold,
      allowBackorder: existing.allowBackorder,
    });

    const action = dto.set !== undefined ? `set to ${dto.set}` : `${(dto.delta ?? 0) >= 0 ? "+" : ""}${dto.delta ?? 0}`;
    patch.activity = [
      logEntry("stock", `Stock ${action}${dto.reason ? ` (${dto.reason})` : ""}`),
      ...(existing.activity ?? []),
    ].slice(0, 50);

    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Product not found"));
    invalidate();
    await auditService.record({
      action: "stock",
      entity: "product",
      entityId: id,
      entityLabel: updated.name,
      summary: `Adjusted stock for "${updated.name}" (${action})`,
    });
    return ok(updated);
  },

  /** Clone a product into a fresh draft (new slug + SKU, zeroed rollups). */
  async duplicate(id: string): Promise<Result<Product>> {
    const repo = getProductRepository();
    const src = await repo.findById(id);
    if (!src) return fail(AppErrors.notFound("Product not found"));

    const name = `${src.name} (Copy)`;
    let slug = slugify(name);
    if (await repo.findBySlug(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    let sku = generateSku(name);
    let guard = 0;
    while ((await repo.skuTakenBy(sku)) && guard < 5) {
      sku = generateSku(name);
      guard += 1;
    }

    const clone: Product = {
      ...src,
      id: newId("p"),
      slug,
      sku,
      name,
      status: "draft",
      featured: false,
      bestseller: false,
      rating: 0,
      reviews: 0,
      ratingAvg: 0,
      ratingCount: 0,
      soldCount: 0,
      viewCount: 0,
      activity: [logEntry("created", `Duplicated from "${src.name}"`)],
    };

    const created = await repo.create(clone);
    invalidate();
    await auditService.record({
      action: "create",
      entity: "product",
      entityId: created.id,
      entityLabel: created.name,
      summary: `Duplicated product "${src.name}" → "${created.name}"`,
    });
    return ok(created);
  },

  /** Bulk status / delete / feature across many products. */
  async bulkUpdate(dto: BulkProductDto): Promise<Result<{ count: number }>> {
    const repo = getProductRepository();
    let count = 0;

    if (dto.action === "delete") {
      for (const id of dto.ids) {
        if (await repo.remove(id)) count += 1;
      }
    } else if (dto.action === "status") {
      count = await repo.bulkUpdate(dto.ids, { status: dto.value as ProductLifecycle });
    } else {
      // feature
      count = await repo.bulkUpdate(dto.ids, { featured: Boolean(dto.value) });
    }

    invalidate();
    await auditService.record({
      action: dto.action === "delete" ? "delete" : dto.action === "status" ? "status" : "update",
      entity: "product",
      summary: `Bulk ${dto.action} on ${count} product(s)`,
    });
    return ok({ count });
  },

  /**
   * Bulk price update across many products. Supports percent change, flat
   * amount, or hard-set, with optional rounding and MRP mirroring. Each
   * product's new price is computed from its own current price, clamped at 0,
   * and logged with a price activity entry.
   */
  async bulkPriceUpdate(dto: BulkPriceDto): Promise<Result<{ count: number }>> {
    const repo = getProductRepository();

    /** Apply the chosen adjustment to a single base price. */
    const compute = (base: number): number => {
      let next: number;
      if (dto.mode === "set") next = dto.value;
      else if (dto.mode === "percent") next = base * (1 + dto.value / 100);
      else next = base + dto.value; // amount
      next = Math.max(0, next);
      if (dto.roundTo && dto.roundTo > 0) {
        next = Math.round(next / dto.roundTo) * dto.roundTo;
      } else {
        next = Math.round(next);
      }
      return next;
    };

    let count = 0;
    for (const id of dto.ids) {
      const p = await repo.findById(id);
      if (!p) continue;

      const newPrice = compute(p.price);
      const patch: Partial<Product> = { price: newPrice };
      if (dto.applyToMrp) {
        // Keep MRP ≥ price; recompute MRP the same way but never below price.
        const newMrp = Math.max(newPrice, compute(p.mrp ?? p.price));
        patch.mrp = newMrp;
      }
      patch.activity = [
        logEntry("price", `Bulk price ${p.price} → ${newPrice} (${describePriceMode(dto)})`),
        ...(p.activity ?? []),
      ].slice(0, 50);

      const updated = await repo.update(id, patch);
      if (updated) count += 1;
    }

    invalidate();
    await auditService.record({
      action: "update",
      entity: "product",
      summary: `Bulk price update (${describePriceMode(dto)}) on ${count} product(s)`,
    });
    return ok({ count });
  },

  /* ---------------------------------------------------------------- *
   * Variant-level CRUD (operate on a single `fullVariants` entry) and
   * rollup-counter increments (view / sold).
   * ---------------------------------------------------------------- */

  /**
   * Normalise an incoming variant payload into the stored `FullVariant` shape,
   * trimming empty strings to `undefined` and defaulting flags.
   */
  _normaliseVariant(v: AddVariantDto): FullVariant {
    return {
      sku: v.sku?.trim() ? v.sku.trim().toUpperCase() : undefined,
      optionValues: v.optionValues ?? {},
      price: v.price,
      mrp: v.mrp,
      stockQty: v.stockQty ?? 0,
      weightGram: v.weightGram,
      barcode: v.barcode?.trim() || undefined,
      image: v.image?.trim() || undefined,
      isDefault: v.isDefault,
      active: v.active ?? true,
    };
  },

  /**
   * After a variant mutation, roll the product-level stock up from the
   * variant matrix so `stockQty` / `inStock` / `stockStatus` stay accurate.
   */
  async _syncVariantStock(id: string, variants: FullVariant[]): Promise<Product | null> {
    const repo = getProductRepository();
    const existing = await repo.findById(id);
    if (!existing) return null;
    const total = variants.reduce((s, v) => s + (v.stockQty ?? 0), 0);
    const stockStatus = deriveStockStatus({
      stockQty: total,
      lowStockThreshold: existing.lowStockThreshold,
      allowBackorder: existing.allowBackorder,
    });
    return repo.update(id, { stockQty: total, inStock: total > 0, stockStatus });
  },

  /** Add a single variant to a product's variant matrix. */
  async addVariant(id: string, dto: AddVariantDto): Promise<Result<Product>> {
    const repo = getProductRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Product not found"));

    const variant = this._normaliseVariant(dto);

    // SKU must be unique within this product's variant matrix (when supplied).
    if (variant.sku && (existing.fullVariants ?? []).some((v) => (v.sku ?? "").toUpperCase() === variant.sku)) {
      return fail(AppErrors.conflict(`Variant SKU "${variant.sku}" already exists on this product`));
    }

    const added = await repo.addVariant(id, variant);
    if (!added) return fail(AppErrors.notFound("Product not found"));

    // Recompute rollup stock, then log + audit.
    const synced = (await this._syncVariantStock(id, added.fullVariants ?? [])) ?? added;
    await repo.update(id, {
      activity: [
        logEntry("note", `Variant added${variant.sku ? ` (${variant.sku})` : ""}`),
        ...(existing.activity ?? []),
      ].slice(0, 50),
    });
    invalidate();
    await auditService.record({
      action: "update",
      entity: "product",
      entityId: id,
      entityLabel: synced.name,
      summary: `Added variant${variant.sku ? ` "${variant.sku}"` : ""} to "${synced.name}"`,
    });
    const fresh = await repo.findById(id);
    return ok(fresh ?? synced);
  },

  /** Update a single variant (identified by its SKU). */
  async updateVariant(id: string, sku: string, dto: UpdateVariantDto): Promise<Result<Product>> {
    const repo = getProductRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Product not found"));

    const target = sku.trim().toUpperCase();
    const current = (existing.fullVariants ?? []).find((v) => (v.sku ?? "").toUpperCase() === target);
    if (!current) return fail(AppErrors.notFound(`Variant "${sku}" not found on this product`));

    // Build a trimmed patch of only the provided fields.
    const patch: Partial<FullVariant> = {};
    if (dto.sku !== undefined) {
      const nextSku = dto.sku.trim() ? dto.sku.trim().toUpperCase() : undefined;
      // Guard against colliding with another variant's SKU.
      if (
        nextSku &&
        nextSku !== target &&
        (existing.fullVariants ?? []).some((v) => (v.sku ?? "").toUpperCase() === nextSku)
      ) {
        return fail(AppErrors.conflict(`Variant SKU "${nextSku}" already exists on this product`));
      }
      patch.sku = nextSku;
    }
    if (dto.optionValues !== undefined) patch.optionValues = dto.optionValues;
    if (dto.price !== undefined) patch.price = dto.price;
    if (dto.mrp !== undefined) patch.mrp = dto.mrp;
    if (dto.stockQty !== undefined) patch.stockQty = dto.stockQty;
    if (dto.weightGram !== undefined) patch.weightGram = dto.weightGram;
    if (dto.barcode !== undefined) patch.barcode = dto.barcode.trim() || undefined;
    if (dto.image !== undefined) patch.image = dto.image.trim() || undefined;
    if (dto.isDefault !== undefined) patch.isDefault = dto.isDefault;
    if (dto.active !== undefined) patch.active = dto.active;

    const updated = await repo.updateVariant(id, current.sku ?? target, patch);
    if (!updated) return fail(AppErrors.notFound("Product not found"));

    // Recompute rollup stock if the variant's stock changed.
    const synced =
      dto.stockQty !== undefined
        ? (await this._syncVariantStock(id, updated.fullVariants ?? [])) ?? updated
        : updated;

    await repo.update(id, {
      activity: [
        logEntry("note", `Variant updated (${patch.sku ?? current.sku ?? target})`),
        ...(existing.activity ?? []),
      ].slice(0, 50),
    });
    invalidate();
    await auditService.record({
      action: "update",
      entity: "product",
      entityId: id,
      entityLabel: synced.name,
      summary: `Updated variant "${current.sku ?? target}" on "${synced.name}"`,
    });
    const fresh = await repo.findById(id);
    return ok(fresh ?? synced);
  },

  /** Remove a single variant (identified by its SKU). */
  async removeVariant(id: string, sku: string): Promise<Result<Product>> {
    const repo = getProductRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Product not found"));

    const target = sku.trim().toUpperCase();
    const current = (existing.fullVariants ?? []).find((v) => (v.sku ?? "").toUpperCase() === target);
    if (!current) return fail(AppErrors.notFound(`Variant "${sku}" not found on this product`));

    const removed = await repo.removeVariant(id, current.sku ?? target);
    if (!removed) return fail(AppErrors.notFound("Product not found"));

    const synced = (await this._syncVariantStock(id, removed.fullVariants ?? [])) ?? removed;
    await repo.update(id, {
      activity: [
        logEntry("note", `Variant removed (${current.sku ?? target})`),
        ...(existing.activity ?? []),
      ].slice(0, 50),
    });
    invalidate();
    await auditService.record({
      action: "update",
      entity: "product",
      entityId: id,
      entityLabel: synced.name,
      summary: `Removed variant "${current.sku ?? target}" from "${synced.name}"`,
    });
    const fresh = await repo.findById(id);
    return ok(fresh ?? synced);
  },

  /**
   * Atomically increment a rollup counter.
   *  • "view" — high frequency, storefront-driven. Does NOT invalidate cache
   *    (an exact view count is not worth a cache stampede); no audit entry.
   *  • "sold" — called by the orders module on a confirmed sale. Invalidates
   *    cache and records an audit entry.
   */
  async incrementCounter(
    id: string,
    counter: "view" | "sold",
    by = 1,
  ): Promise<Result<Product>> {
    const repo = getProductRepository();
    const amount = Math.max(1, Math.floor(by));
    const updated = await repo.incCounter(id, counter, amount);
    if (!updated) return fail(AppErrors.notFound("Product not found"));

    if (counter === "sold") {
      invalidate();
      await auditService.record({
        action: "update",
        entity: "product",
        entityId: id,
        entityLabel: updated.name,
        summary: `Sold count +${amount} for "${updated.name}" (total ${updated.soldCount ?? 0})`,
      });
    }
    return ok(updated);
  },
};
