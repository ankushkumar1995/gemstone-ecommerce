/**
 * Admin auth domain — types.
 *
 * Kept intentionally small for the demo phase. In a later phase this becomes
 * a real users collection + hashed passwords + NextAuth. The shapes here are
 * what the rest of the admin app depends on.
 */

import type { Permission } from "@/modules/users";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  /** Role id (e.g. "role_owner"). Resolved from the users module. */
  roleId: string;
  /** Friendly role name for display (e.g. "Owner"). */
  roleName: string;
  /** Flattened permission set used by `can()` across the panel. */
  permissions: Permission[];
}

export interface AdminSession {
  user: AdminUser;
  /** epoch ms when the session expires */
  expiresAt: number;
}
