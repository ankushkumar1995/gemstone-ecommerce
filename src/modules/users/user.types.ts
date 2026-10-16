/**
 * Users / RBAC domain — types.
 *
 * The admin panel's access control is data-driven: a role is just a set of
 * `resource:action` permission strings, and the current user's session carries
 * the resolved set. This keeps "who can do what" in data (easy to extend to
 * custom roles later) rather than scattered `if (role === "admin")` checks.
 */

/** The actions a user can perform on a resource. */
export type Action = "view" | "create" | "edit" | "delete";

/** Admin sections guarded by permissions (one per manageable area). */
export type Resource =
  | "products"
  | "categories"
  | "collections"
  | "blog"
  | "pages"
  | "media"
  | "orders"
  | "returns"
  | "customers"
  | "leads"
  | "reviews"
  | "coupons"
  | "banners"
  | "services"
  | "payments"
  | "reports"
  | "audit"
  | "settings"
  | "users";

/** A single permission, e.g. "orders:edit". "*:*" is the superuser wildcard. */
export type Permission = `${Resource}:${Action}` | "*:*";

/** Lifecycle of an admin user account. */
export type UserStatus = "active" | "invited" | "disabled" | "suspended";

/** A role bundles a set of permissions under a friendly name. */
export interface Role {
  id: string;
  /** Stable code key (e.g. "owner"). */
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
  /** System (preset) roles cannot be edited or deleted from the UI. */
  isSystem: boolean;
  /** Higher = more powerful (owner highest). Drives privilege rules. */
  priority: number;
}

/**
 * An admin user as the app sees it (secrets are never included — passwordHash
 * and tokens are select:false in the DB and stripped in toJSON).
 */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  avatarColor?: string;
  roleId: string;
  status: UserStatus;

  // login tracking
  lastLoginAt?: string;
  lastSeenAt?: string;
  loginCount?: number;

  // suspension (visible context for admins)
  suspendedReason?: string;
  suspendedAt?: string;

  // lockout (brute-force auto-lock) — surfaced so admins can unlock
  lockedUntil?: string;
  isLocked?: boolean;

  // invite
  invitedBy?: string;
  acceptedAt?: string;

  // soft delete
  isDeleted?: boolean;
  deletedAt?: string;

  createdAt: string;
  updatedAt: string;
}

/** A user with its role resolved + flattened permission set (for the session). */
export interface ResolvedUser extends AdminUser {
  role: Role;
  permissions: Permission[];
}
