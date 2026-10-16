/**
 * Core domain types for the gemstone / astrology ecommerce store.
 * These are shared across the data layer, UI components and (future) API client.
 */

export type ZodiacSign =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces";

export type Planet =
  | "Sun"
  | "Moon"
  | "Mars"
  | "Mercury"
  | "Jupiter"
  | "Venus"
  | "Saturn"
  | "Rahu"
  | "Ketu";

/**
 * Product category slug. Categories are now dynamic (admin-managed via the
 * categories module), so this is an open string rather than a fixed enum.
 * The seed slugs — "rings" | "pendants" | "bracelets" | "loose-stones" |
 * "rudraksha" — still exist, but admins can add/remove freely.
 */
export type ProductCategory = string;

export interface Zodiac {
  sign: ZodiacSign;
  name: string;
  symbol: string;
  dateRange: string;
  element: "Fire" | "Earth" | "Air" | "Water";
  rulingPlanet: Planet;
  luckyStone: string;
  accent: string; // hex used for subtle per-sign theming
  image: string; // HD lucky-stone photo used as the card backdrop
}

export interface Category {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  image: string; // real photo URL
  tint: string; // brand gradient overlay for mood + readability
  order?: number; // display order (lower = first)
  status?: "active" | "inactive"; // storefront visibility
  createdAt?: string;
  updatedAt?: string;
}

export interface GemstoneAttributes {
  stone: string;
  planet: Planet;
  benefits: string[];
  origin: string;
  weightCarat: number;
  certification: string;
  color: string;
}

/**
 * Publishing workflow states.
 *  draft    → work in progress, not visible on store
 *  review   → submitted, awaiting approval
 *  active   → live / published on store
 *  archived → retired, hidden from store
 */
export type ProductStatus = "draft" | "review" | "active" | "archived";

export interface ProductVariant {
  id: string;
  label: string; // e.g. "5 carat"
  price: number;
  stockQty: number;
  sku?: string;
}

/** A single entry in a product's activity/audit timeline. */
export interface ProductActivity {
  id: string;
  at: string; // ISO timestamp
  type:
    | "created"
    | "updated"
    | "status"
    | "scheduled"
    | "published"
    | "price"
    | "stock"
    | "note";
  message: string;
  actor?: string; // who did it (demo: "Admin")
}

/** Search-engine / social metadata for a product. */
export interface ProductSeo {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  keywords?: string[];
  noindex?: boolean;
}

/** A rich, titled content block shown as a tab on the storefront PDP. */
export interface ProductContentSection {
  id: string;
  heading: string; // e.g. "Details", "Benefits", "Certification", "How to wear"
  body: string; // markdown-ish / plain text
}

/** A product video or 360° spin source. */
export interface ProductVideo {
  id: string;
  url: string;
  kind: "video" | "spin360";
  label?: string;
}

/** A storefront collection — a dynamic, admin-managed grouping of products. */
export interface Collection {
  id: string;
  slug: string;
  title: string;
  description?: string;
  image?: string;
  featured?: boolean; // pin to homepage
  createdAt: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  price: number;
  mrp: number;
  rating: number;
  reviews: number;
  image: string;
  gradient: string; // tailwind-friendly gradient for mock imagery
  zodiac: ZodiacSign[];
  badge?: "Bestseller" | "New" | "Limited" | "Certified";
  shortDescription: string;
  attributes: GemstoneAttributes;
  inStock: boolean;

  /* --- extended catalog fields (optional for backward compatibility) --- */
  status?: ProductStatus; // draft | review | active | archived (defaults to active)
  stockQty?: number; // real inventory count
  sku?: string;
  tags?: string[];
  images?: string[]; // full gallery; `image` remains the cover
  /** Per-image alt text for SEO/accessibility, keyed by the image URL. */
  imageAlts?: Record<string, string>;
  variants?: ProductVariant[];

  /* --- workflow --- */
  publishAt?: string; // ISO; when set + status "review"/"draft", auto-goes live at this time
  activity?: ProductActivity[]; // audit timeline (newest first)

  /* --- SEO & rich content --- */
  seo?: ProductSeo;
  content?: ProductContentSection[]; // storefront PDP tabs

  /* --- media extensions --- */
  videos?: ProductVideo[]; // video + 360° spin sources
  certificatePdf?: string; // lab certificate PDF url

  /* --- organisation & catalog --- */
  collections?: string[]; // Collection ids this product belongs to
  related?: string[]; // related / "frequently bought with" product ids
  featured?: boolean; // pin to homepage

  /* ---------------------------------------------------------------- *
   * Production catalogue surface (optional — populated by the Mongo
   * repository). Legacy fields above remain the storefront contract;
   * these carry the richer admin/production data.
   * ---------------------------------------------------------------- */
  subtitle?: string;
  brand?: string;
  categoryId?: string | null; // ObjectId ref (string form); `category` keeps the slug
  collectionIds?: string[];
  relatedIds?: string[];

  currency?: string; // default "INR"
  costPrice?: number; // never exposed on the storefront
  taxClass?: "none" | "gst_3" | "gst_5" | "gst_12" | "gst_18";
  hsnCode?: string;

  hasVariants?: boolean;
  options?: Array<{ name: string; values: string[] }>;
  fullVariants?: Array<{
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
  }>;

  trackInventory?: boolean;
  lowStockThreshold?: number;
  allowBackorder?: boolean;
  warehouseLocation?: string;
  stockStatus?: "in_stock" | "low_stock" | "out_of_stock" | "backorder";

  coverImage?: string; // mirrors `image`
  description?: string; // long-form; `shortDescription` stays the teaser
  specifications?: Array<{ label: string; value?: string }>;
  faqs?: Array<{ q: string; a?: string }>;

  weightGram?: number;
  dimensions?: { length?: number; width?: number; height?: number };
  shippingClass?: "standard" | "fragile" | "insured" | "free";
  makingCharges?: number;

  gemstone?: {
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
  };

  badgeIsNull?: boolean; // internal — allow explicit "no badge"
  bestseller?: boolean;
  displayOrder?: number;

  ratingAvg?: number;
  ratingCount?: number;
  soldCount?: number;
  viewCount?: number;
}

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  rating: number;
  quote: string;
  initials: string;
}

/* ------------------------------------------------------------------ *
 * Blog / Articles — admin-managed content, read by the storefront.
 * ------------------------------------------------------------------ */

/** A single rich content block in an article body. */
export interface ArticleBlock {
  type: "p" | "h2" | "quote" | "list";
  text?: string; // for p / h2 / quote
  items?: string[]; // for list
}

export type ArticleStatus = "draft" | "published";

export interface ArticleActivity {
  id: string;
  at: string; // ISO
  type: "created" | "updated" | "status" | "note";
  message: string;
  actor?: string;
}

export interface ArticleSeo {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readMins: number;
  image: string;
  author: string;
  authorRole: string;
  date: string; // ISO — display/publish date
  tags: string[];
  featured?: boolean;
  /** legacy structured blocks — kept for seeded content & fallback rendering */
  body: ArticleBlock[];
  /** rich HTML authored in the WYSIWYG editor (preferred when present) */
  content?: string;

  /* workflow + meta */
  status: ArticleStatus; // draft | published
  seo?: ArticleSeo;
  activity?: ArticleActivity[];
  createdAt?: string;
  updatedAt?: string;
}

/* ------------------------------------------------------------------ *
 * Astrology services — admin-managed offerings (consultations etc.)
 * ------------------------------------------------------------------ */

export type ServiceStatus = "active" | "inactive";

export interface AstroService {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  icon: string; // lucide icon name (resolved in the view)
  priceFrom: number; // INR (0 = free)
  duration: string; // e.g. "45 min"
  popular?: boolean;
  features: string[];
  status: ServiceStatus;
  order: number; // display order (lower = first)
  createdAt?: string;
  updatedAt?: string;
}
