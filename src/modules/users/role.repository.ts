import "server-only";

/**
 * Roles repository (Mongoose). Roles live in their own collection; preset
 * roles are seeded from rbac.PRESET_ROLES on first use so the app always has
 * them. Reads are cached (roles change rarely) to keep user queries fast.
 */

import { cache } from "@/core/cache";
import { PRESET_ROLES } from "./rbac";
import type { Permission, Role } from "./user.types";
import type { RoleDoc } from "./role.model";

const ROLES_CACHE = "roles:all";
const ROLES_TTL = 300; // 5 min

function fromDoc(doc: RoleDoc): Role {
  return {
    id: String(doc._id),
    key: doc.key,
    name: doc.name,
    description: doc.description ?? "",
    permissions: (doc.permissions ?? []) as Permission[],
    isSystem: doc.isSystem ?? false,
    priority: doc.priority ?? 0,
  };
}

async function model() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  const { RoleModel } = await import("./role.model");
  await connectMongoose();
  return RoleModel;
}

/** Seed preset roles if the collection is empty. Idempotent. */
/**
 * One-time additive migration: when new resources are introduced, grant their
 * preset permissions to EXISTING system roles. Runs once per migration key
 * (recorded in the `migrations` collection), so permissions an owner later
 * removes on purpose are never re-added. Never removes anything.
 */
const ROLE_MIGRATIONS: { key: string; resources: string[] }[] = [
  { key: "roles-astrologer-platform-v1", resources: ["astrologers", "consultations", "wallets", "payouts"] },
  { key: "roles-poojas-v1", resources: ["poojas"] },
];

async function migrateSystemRoles(M: Awaited<ReturnType<typeof model>>): Promise<void> {
  const db = M.db.db;
  if (!db) return;
  const done = db.collection<{ _id: string; at: Date }>("migrations");
  for (const mig of ROLE_MIGRATIONS) {
    if (await done.findOne({ _id: mig.key })) continue;
    for (const preset of PRESET_ROLES) {
      const add = preset.permissions.filter((p) => mig.resources.some((r) => p.startsWith(`${r}:`)));
      if (add.length) await M.updateOne({ key: preset.key }, { $addToSet: { permissions: { $each: add } } });
    }
    await done.updateOne({ _id: mig.key }, { $set: { at: new Date() } }, { upsert: true });
  }
}

async function ensureSeeded(): Promise<void> {
  const M = await model();
  const count = await M.estimatedDocumentCount();
  if (count > 0) {
    await migrateSystemRoles(M).catch(() => {
      /* never block role loading on a migration hiccup; it retries next load */
    });
    return;
  }
  await M.insertMany(
    PRESET_ROLES.map((r) => ({
      key: r.key,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      isSystem: r.isSystem,
      priority: r.priority,
    })),
    { ordered: false },
  ).catch(() => {
    /* a concurrent seed may race; unique key index makes it safe to ignore */
  });
}

export const roleRepository = {
  /** All roles (cached). Seeds presets on first call. */
  async findAll(): Promise<Role[]> {
    return cache.wrap(ROLES_CACHE, ROLES_TTL, async () => {
      await ensureSeeded();
      const M = await model();
      const docs = await M.find().sort({ priority: -1 }).lean<RoleDoc[]>();
      return docs.map(fromDoc);
    });
  },

  async findById(id: string): Promise<Role | null> {
    const all = await this.findAll();
    return all.find((r) => r.id === id) ?? null;
  },

  async findByKey(key: string): Promise<Role | null> {
    const all = await this.findAll();
    return all.find((r) => r.key === key) ?? null;
  },

  /** A quick id→Role map so user listings resolve roles with no N+1 queries. */
  async map(): Promise<Map<string, Role>> {
    const all = await this.findAll();
    return new Map(all.map((r) => [r.id, r]));
  },

  invalidate() {
    cache.del(ROLES_CACHE);
  },
};
