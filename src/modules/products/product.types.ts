/**
 * Products domain — app-facing types.
 *
 * These describe the production catalogue shape (string ids, not ObjectIds) as
 * surfaced by the repository to the service/controller. The storefront `Product`
 * in `@/types` stays the public contract (and keeps all its legacy fields for
 * backward compatibility); the fields below extend it with the production
 * surface (variants, inventory, shipping, SEO, rollups…).
 */

export type ProductLifecycle = "draft" | "active" | "archived";

export type TaxClass = "none" | "gst_3" | "gst_5" | "gst_12" | "gst_18";

export type ShippingClass = "standard" | "fragile" | "insured" | "free";

export type ProductBadge = "Bestseller" | "New" | "Limited" | "Certified";

/** Derived stock status surfaced to the admin table. */
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "backorder";

export interface ProductOption {
  name: string;
  values: string[];
}

export interface ProductFullVariant {
  sku?: string;
  optionValues: Record<string, string>;
  price?: number;
  mrp?: number;
  stockQty: number;
  weightGram?: number;
  barcode?: string;
  image?: string;
  isDefault?: boolean;
  active?: boolean;
}

export interface ProductDimensions {
  length?: number;
  width?: number;
  height?: number;
}

export interface ProductGemstone {
  stone?: string;
  planet?: string;
  benefits?: string[];
  origin?: string;
  weightCarat?: number;
  certification?: string;
  color?: string;
  clarity?: string;
  cut?: string;
  treatment?: string;
  labName?: string;
  certificateNumber?: string;
}

export interface ProductSpec {
  label: string;
  value?: string;
}

export interface ProductFaq {
  q: string;
  a?: string;
}

/** Filters accepted by the paginated/searchable product listing. */
export interface ProductSearchFilters {
  categoryId?: string;
  status?: ProductLifecycle;
  featured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  tag?: string;
}
