/**
 * Seed script — loads mock seed data into MongoDB so the real DB isn't empty
 * after switching DATA_SOURCE=mongo.
 *
 * Run with tsx (installed as a dev dependency):
 *   npm run seed            # seed only empty collections
 *   npm run seed -- --fresh # drop + reseed everything
 *
 * It uses the SAME seed arrays the mock repositories use, so there is a single
 * source of truth. The string `id` on each record is stored as Mongo `_id`,
 * matching what the Mongo repositories read/write.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";

import { services } from "../src/data/services";
import { categories } from "../src/data/categories";
import { products } from "../src/data/products";
import { customers } from "../src/data/customers";
import { orders } from "../src/data/orders";
import { articles } from "../src/data/articles";
import { coupons } from "../src/data/coupons";
import { banners } from "../src/data/banners";
import { DEFAULT_SETTINGS } from "../src/data/settings";
import { PRESET_ROLES } from "../src/modules/users/rbac";

/**
 * Map a mock Product (legacy storefront shape) → the production Mongo document
 * shape (see src/modules/products/product.model.ts). Keeps the seed valid:
 * every product gets a SKU, a required coverImage, and gemstone attributes.
 */
function mapProduct(record: { id: string } & Record<string, unknown>) {
  const p = record as unknown as {
    slug: string;
    name: string;
    category?: string;
    price: number;
    mrp?: number;
    rating?: number;
    reviews?: number;
    image: string;
    zodiac?: string[];
    badge?: string | null;
    shortDescription?: string;
    attributes?: Record<string, unknown>;
    inStock?: boolean;
    status?: string;
    stockQty?: number;
    tags?: string[];
    featured?: boolean;
  };
  const attrs = p.attributes ?? {};
  const sku = `${p.slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 16).replace(/-+$/g, "")}`;
  const qty = p.stockQty ?? (p.inStock === false ? 0 : 25);
  const status = p.status === "active" || p.status === "archived" || p.status === "draft" ? p.status : "active";
  return {
    sku,
    slug: p.slug,
    name: p.name,
    status,
    // categoryId is left null in the seed (mock category is a slug, not an ObjectId);
    // keep the legacy slug alongside so storefront reads still resolve.
    categoryId: null,
    categorySlug: p.category ?? "",
    collectionIds: [],
    tags: p.tags ?? [],
    zodiac: p.zodiac ?? [],
    relatedIds: [],
    price: p.price,
    mrp: p.mrp ?? p.price,
    currency: "INR",
    taxClass: "gst_3",
    hasVariants: false,
    options: [],
    variants: [],
    trackInventory: true,
    stockQty: qty,
    lowStockThreshold: 3,
    allowBackorder: false,
    coverImage: p.image,
    images: [p.image],
    videos: [],
    shippingClass: "standard",
    gemstone: {
      stone: attrs.stone,
      planet: attrs.planet,
      benefits: Array.isArray(attrs.benefits) ? attrs.benefits : [],
      origin: attrs.origin,
      weightCarat: attrs.weightCarat,
      certification: attrs.certification,
      color: attrs.color,
    },
    shortDescription: p.shortDescription ?? "",
    contentSections: [],
    specifications: [],
    faqs: [],
    featured: p.featured ?? false,
    badge: p.badge ?? null,
    bestseller: p.badge === "Bestseller",
    displayOrder: 0,
    ratingAvg: p.rating ?? 0,
    ratingCount: p.reviews ?? 0,
    soldCount: 0,
    viewCount: 0,
    isDeleted: false,
  };
}

/**
 * Map a mock Customer → the production Mongo document shape. Drops the string
 * `id` (Mongo assigns an ObjectId) and strips embedded address ids (the model's
 * AddressSchema has no _id). Keeps the activity timeline + lifetime stats.
 */
function mapCustomer(record: { id: string } & Record<string, unknown>) {
  const c = record as unknown as {
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    status?: string;
    tags?: string[];
    notes?: string;
    addresses?: Array<Record<string, unknown>>;
    totalOrders?: number;
    totalSpent?: number;
    lastOrderAt?: string;
    activity?: Array<Record<string, unknown>>;
    createdAt?: string;
  };
  return {
    name: c.name,
    email: c.email.toLowerCase(),
    phone: c.phone ?? null,
    avatar: c.avatar ?? null,
    status: c.status === "vip" || c.status === "blocked" ? c.status : "active",
    tags: c.tags ?? [],
    notes: c.notes ?? null,
    addresses: (c.addresses ?? []).map((a, i) => {
      const addr = a as { id?: string } & Record<string, unknown>;
      // Addresses now carry a required stable id (used for edit/remove/default).
      return { ...addr, id: addr.id ?? `adr_seed_${i}` };
    }),
    totalOrders: c.totalOrders ?? 0,
    totalSpent: c.totalSpent ?? 0,
    lastOrderAt: c.lastOrderAt ?? null,
    activity: c.activity ?? [],
    isDeleted: false,
  };
}

/**
 * Map a mock Order → the production Mongo document shape. Drops the string `id`
 * and the app `updatedAt` (Mongo timestamps manage it); keeps `placedAt`, the
 * snapshotted customer/items, pricing, addresses, fulfillment and activity.
 */
function mapOrder(record: { id: string } & Record<string, unknown>) {
  const { id, updatedAt, ...rest } = record as { id: string; updatedAt?: unknown } & Record<string, unknown>;
  void id;
  void updatedAt;
  return { ...rest, isDeleted: false };
}

/**
 * Map a mock Article → the production Mongo document shape. Drops the string
 * id + app timestamps (Mongo manages them); keeps body/content/seo/status/etc.
 */
function mapArticle(record: { id: string } & Record<string, unknown>) {
  const { id, createdAt, updatedAt, ...rest } = record as {
    id: string;
    createdAt?: unknown;
    updatedAt?: unknown;
  } & Record<string, unknown>;
  void id;
  void createdAt;
  void updatedAt;
  return { ...rest, isDeleted: false };
}

/** Map a mock Service → production shape (drop string id; keep slug + fields). */
function mapService(record: { id: string } & Record<string, unknown>) {
  const { id, createdAt, updatedAt, ...rest } = record as {
    id: string;
    createdAt?: unknown;
    updatedAt?: unknown;
  } & Record<string, unknown>;
  void id;
  void createdAt;
  void updatedAt;
  return { ...rest };
}

/** Map a mock Banner → production shape (drop string id). */
function mapBanner(record: { id: string } & Record<string, unknown>) {
  const { id, createdAt, ...rest } = record as { id: string; createdAt?: unknown } & Record<string, unknown>;
  void id;
  void createdAt;
  return { ...rest, isDeleted: false };
}

/** Map a mock Coupon → the production Mongo document shape (drop string id). */
function mapCoupon(record: { id: string } & Record<string, unknown>) {
  const { id, createdAt, status, ...rest } = record as {
    id: string;
    createdAt?: unknown;
    status?: unknown;
  } & Record<string, unknown>;
  void id;
  void createdAt;
  void status; // derived at read time, never stored
  return { ...rest, isDeleted: false };
}

const FRESH = process.argv.includes("--fresh");
/** Optional: limit to one collection, e.g. `--only=categories`. */
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];

/** Load .env manually (tsx does not auto-load it). */
function loadEnv(): Record<string, string> {
  const file = path.resolve(process.cwd(), ".env");
  const raw = readFileSync(file, "utf8");
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function dbNameFromUri(uri: string): string {
  const afterHost = uri.split("/").slice(3).join("/");
  const name = afterHost.split("?")[0];
  return name && name.length ? name : "astro_unkle_dev";
}

/**
 * Each entry maps a collection to its seed array.
 *  • idStrategy "string" → store the record's string `id` as `_id` (legacy).
 *  • idStrategy "objectId" → drop the string `id`, let Mongo assign an ObjectId
 *    and Mongoose timestamps fill createdAt/updatedAt (production shape).
 */
const COLLECTIONS: Array<{
  name: string;
  data: ReadonlyArray<{ id: string } & Record<string, unknown>>;
  idStrategy: "string" | "objectId";
  /** Optional transform: reshape a seed record into its DB document form. */
  map?: (record: { id: string } & Record<string, unknown>) => Record<string, unknown>;
}> = [
  {
    name: "services",
    data: services as unknown as ReadonlyArray<{ id: string } & Record<string, unknown>>,
    idStrategy: "objectId",
    map: mapService,
  },
  { name: "categories", data: categories as unknown as ReadonlyArray<{ id: string } & Record<string, unknown>>, idStrategy: "objectId" },
  {
    name: "products",
    data: products as unknown as ReadonlyArray<{ id: string } & Record<string, unknown>>,
    idStrategy: "objectId",
    map: mapProduct,
  },
  {
    name: "customers",
    data: customers as unknown as ReadonlyArray<{ id: string } & Record<string, unknown>>,
    idStrategy: "objectId",
    map: mapCustomer,
  },
  {
    name: "orders",
    data: orders as unknown as ReadonlyArray<{ id: string } & Record<string, unknown>>,
    idStrategy: "objectId",
    map: mapOrder,
  },
  {
    name: "articles",
    data: articles as unknown as ReadonlyArray<{ id: string } & Record<string, unknown>>,
    idStrategy: "objectId",
    map: mapArticle,
  },
  {
    name: "coupons",
    data: coupons as unknown as ReadonlyArray<{ id: string } & Record<string, unknown>>,
    idStrategy: "objectId",
    map: mapCoupon,
  },
  {
    name: "banners",
    data: banners as unknown as ReadonlyArray<{ id: string } & Record<string, unknown>>,
    idStrategy: "objectId",
    map: mapBanner,
  },
];

async function main() {
  const env = loadEnv();
  const uri = env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing in .env");

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  const db = client.db(dbNameFromUri(uri));
  console.log("Connected to", db.databaseName);

  try {
    for (const { name, data, idStrategy, map } of COLLECTIONS) {
      if (ONLY && name !== ONLY) continue;
      const col = db.collection(name);
      const count = await col.countDocuments();

      if (FRESH) {
        await col.deleteMany({});
        console.log(`• ${name}: dropped (${count} removed)`);
      } else if (count > 0) {
        console.log(`• ${name}: already has ${count} docs — skipping`);
        continue;
      }

      const now = new Date();
      const docs = data.map((record) => {
        // Apply a per-collection reshape first (e.g. products → production shape).
        const shaped = map ? { id: record.id, ...map(record) } : record;
        const { id, createdAt, updatedAt, ...rest } = shaped;
        void updatedAt;
        if (idStrategy === "objectId") {
          // Mongo assigns _id; Mongoose-style timestamps as real Dates.
          return {
            ...rest,
            createdAt: createdAt ? new Date(String(createdAt)) : now,
            updatedAt: now,
          };
        }
        // legacy: string id becomes _id
        return { _id: id, ...rest };
      });

      if (docs.length) {
        await col.insertMany(docs as never);
        console.log(`• ${name}: inserted ${docs.length} docs (${idStrategy} ids)`);
      }
    }
    // Settings (singleton config document under a fixed _id).
    if (!ONLY || ONLY === "settings") {
      await seedSettings(db);
    }

    // Roles + Owner user (cross-referenced; needs its own step).
    if (!ONLY || ONLY === "roles" || ONLY === "users") {
      await seedRolesAndOwner(db, env);
    }

    console.log("✅ Seed complete.");
  } finally {
    await client.close();
  }
}

/**
 * Seed the singleton store-settings document. The settings model stores the
 * whole config under `data` with a fixed `_id: "store"`. Respects --fresh.
 */
async function seedSettings(db: import("mongodb").Db) {
  const col = db.collection("settings");
  const existing = await col.findOne({ _id: "store" as never });
  if (existing && !FRESH) {
    console.log("• settings: already present — skipping");
    return;
  }
  const now = new Date();
  await col.replaceOne(
    { _id: "store" as never },
    { _id: "store", data: DEFAULT_SETTINGS, createdAt: now, updatedAt: now } as never,
    { upsert: true },
  );
  console.log("• settings: seeded singleton (store)");
}

/** Seed the preset roles and the Owner admin user (linked by ObjectId). */
async function seedRolesAndOwner(
  db: import("mongodb").Db,
  env: Record<string, string>,
) {
  const now = new Date();
  const roles = db.collection("roles");
  const users = db.collection("users");

  if (FRESH) {
    if (!ONLY || ONLY === "roles") await roles.deleteMany({});
    if (!ONLY || ONLY === "users") await users.deleteMany({});
  }

  // Roles
  if ((await roles.countDocuments()) === 0) {
    await roles.insertMany(
      PRESET_ROLES.map((r) => ({
        key: r.key,
        name: r.name,
        description: r.description,
        permissions: r.permissions,
        isSystem: r.isSystem,
        priority: r.priority,
        createdAt: now,
        updatedAt: now,
      })),
    );
    console.log(`• roles: inserted ${PRESET_ROLES.length} docs`);
  } else {
    console.log("• roles: already present — skipping");
  }

  // Owner user, linked to the owner role's ObjectId, WITH a hashed password so
  // the owner can log in. Default password from env (ADMIN_PASSWORD) or a dev
  // fallback; forced to change on first login.
  if ((await users.countDocuments()) === 0) {
    const bcrypt = (await import("bcryptjs")).default;
    const ownerRole = await roles.findOne({ key: "owner" });
    const ownerEmail = (env.ADMIN_EMAIL ?? "admin@astrounkle.com").toLowerCase();
    const ownerPassword = env.ADMIN_PASSWORD ?? "admin123";
    const passwordHash = await bcrypt.hash(ownerPassword, 12);
    await users.insertOne({
      name: "Store Owner",
      email: ownerEmail,
      roleId: ownerRole?._id ?? null,
      status: "active",
      avatarColor: "#c9942a",
      passwordHash,
      mustChangePassword: true,
      passwordChangedAt: now,
      isDeleted: false,
      loginCount: 0,
      failedLoginCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`• users: inserted 1 doc (Owner → ${ownerEmail}, password: ${ownerPassword})`);
  } else {
    console.log("• users: already present — skipping");
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("❌ Seed failed:", msg);
  process.exit(1);
});
