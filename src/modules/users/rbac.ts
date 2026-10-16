/**
 * Users / RBAC domain — the permission system.
 *
 * Pure data + pure functions (no DB, no I/O), so it is safe to import from
 * anywhere, including client components that only need to render what a user
 * can see. The server is still the real gate (see user.service guards).
 */

import type { Action, Permission, Resource } from "./user.types";

/** A role seed definition (no id — the DB assigns ObjectId on seed). */
export interface RoleSeed {
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  priority: number;
}

/** All guarded resources (mirrors admin sections). */
export const RESOURCES: Resource[] = [
  "products",
  "categories",
  "collections",
  "blog",
  "pages",
  "media",
  "orders",
  "returns",
  "customers",
  "leads",
  "reviews",
  "coupons",
  "banners",
  "services",
  "payments",
  "reports",
  "audit",
  "settings",
  "users",
];

/** The four actions, in display order. */
export const ACTIONS: Action[] = ["view", "create", "edit", "delete"];

/** Human labels for resources (for the roles matrix UI). */
export const RESOURCE_LABELS: Record<Resource, string> = {
  products: "Products",
  categories: "Categories",
  collections: "Collections",
  blog: "Blog",
  pages: "Pages",
  media: "Media",
  orders: "Orders",
  returns: "Returns",
  customers: "Customers",
  leads: "Leads",
  reviews: "Reviews",
  coupons: "Coupons",
  banners: "Banners",
  services: "Services",
  payments: "Payments",
  reports: "Reports",
  audit: "Activity Log",
  settings: "Settings",
  users: "Users & Roles",
};

/* ---------------- permission builders ---------------- */

/** All four actions on a resource: ["x:view","x:create","x:edit","x:delete"]. */
export function all(resource: Resource): Permission[] {
  return ACTIONS.map((a) => `${resource}:${a}` as Permission);
}

/** view-only on a resource. */
export function viewOnly(resource: Resource): Permission[] {
  return [`${resource}:view` as Permission];
}

/** Specific actions on a resource. */
function only(resource: Resource, actions: Action[]): Permission[] {
  return actions.map((a) => `${resource}:${a}` as Permission);
}

/** Full access to every resource (shorthand we expand at check time). */
export const SUPERUSER: Permission[] = ["*:*"];

/* ---------------- preset roles ---------------- */

const contentResources: Resource[] = ["products", "blog", "pages", "media", "banners", "categories", "collections"];

/**
 * Preset roles — seeded into the `roles` collection. `priority` ranks power
 * (owner highest); privilege rules compare priorities. `key` is the stable
 * code identifier; the DB assigns each role an ObjectId `id` on seed.
 */
export const PRESET_ROLES: RoleSeed[] = [
  {
    key: "owner",
    name: "Owner",
    description: "Full access to everything, including users and settings. The account owner.",
    permissions: SUPERUSER,
    isSystem: true,
    priority: 100,
  },
  {
    key: "admin",
    name: "Admin",
    description: "Full access to the store. Can manage users but not override the Owner.",
    permissions: RESOURCES.flatMap(all),
    isSystem: true,
    priority: 80,
  },
  {
    key: "manager",
    name: "Manager",
    description: "Runs day-to-day store ops: catalog, orders, customers, marketing. No settings or users.",
    permissions: [
      ...all("products"),
      ...all("categories"),
      ...all("collections"),
      ...all("orders"),
      ...all("returns"),
      ...all("customers"),
      ...all("leads"),
      ...all("coupons"),
      ...all("banners"),
      ...all("services"),
      ...all("reviews"),
      ...viewOnly("reports"),
      ...viewOnly("payments"),
    ],
    isSystem: true,
    priority: 60,
  },
  {
    key: "editor",
    name: "Editor",
    description: "Manages content only: products, blog, pages, media, banners, collections.",
    permissions: contentResources.flatMap(all),
    isSystem: true,
    priority: 40,
  },
  {
    key: "support",
    name: "Support",
    description: "Handles customers: orders (view + update), returns, leads, customer records.",
    permissions: [
      ...only("orders", ["view", "edit"]),
      ...all("returns"),
      ...all("leads"),
      ...only("customers", ["view", "edit"]),
      ...viewOnly("reviews"),
      ...viewOnly("products"),
    ],
    isSystem: true,
    priority: 30,
  },
  {
    key: "viewer",
    name: "Viewer",
    description: "Read-only access across the whole admin panel.",
    permissions: RESOURCES.flatMap(viewOnly),
    isSystem: true,
    priority: 10,
  },
];

/** Look up a preset role seed by key. */
export function findPresetRole(key: string): RoleSeed | undefined {
  return PRESET_ROLES.find((r) => r.key === key);
}

/* ---------------- the check ---------------- */

/**
 * Does this permission set satisfy the required `resource:action`?
 * Honours the "*:*" superuser wildcard and a per-resource "x:*" if present.
 */
export function hasPermission(
  granted: Permission[] | undefined,
  resource: Resource,
  action: Action,
): boolean {
  if (!granted || granted.length === 0) return false;
  if (granted.includes("*:*")) return true;
  if (granted.includes(`${resource}:*` as Permission)) return true;
  return granted.includes(`${resource}:${action}`);
}

/**
 * Convenience form used across UI/guards:
 *   can(permissions, "orders:edit")
 */
export function can(granted: Permission[] | undefined, perm: `${Resource}:${Action}`): boolean {
  const [resource, action] = perm.split(":") as [Resource, Action];
  return hasPermission(granted, resource, action);
}

/** Can the user see this resource at all (any action)? Used for sidebar/pages. */
export function canView(granted: Permission[] | undefined, resource: Resource): boolean {
  return hasPermission(granted, resource, "view");
}

/** Expand a permission set into concrete perms (resolves "*:*"). */
export function expandPermissions(permissions: Permission[]): Permission[] {
  if (permissions.includes("*:*")) {
    return RESOURCES.flatMap(all);
  }
  return permissions;
}
