import "server-only";

/**
 * Server-side admin guard — the REAL security boundary for /api routes.
 *
 * Reads the session cookie, verifies the JWT, loads the user + role FRESH from
 * the DB (so disabled/suspended/role-changed takes effect immediately), and
 * optionally checks a `resource:action` permission. The edge proxy only guards
 * /admin pages, so every protected API route must call this itself.
 *
 *   const guard = await requireAdmin("users:edit");
 *   if (!guard.ok) return jsonError(guard.error);
 *   const { session } = guard.value;
 */

import { cookies, headers } from "next/headers";
import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { can } from "@/modules/users/rbac";
import { clientIp } from "@/core/rate-limit";
import { roleRepository, type Actor, type Resource, type Action } from "@/modules/users";
import { adminAuthService, ACCESS_COOKIE } from "./admin-auth.service";
import type { AdminSession } from "./admin-auth.types";

/** Require a valid admin session; optionally require a `resource:action` perm. */
export async function requireAdmin(
  permission?: `${Resource}:${Action}`,
): Promise<Result<{ session: AdminSession }>> {
  const [store, hdrs] = await Promise.all([cookies(), headers()]);
  const raw = store.get(ACCESS_COOKIE)?.value;
  const ctx = { ip: clientIp(hdrs), userAgent: hdrs.get("user-agent") ?? "" };
  const session = await adminAuthService.getSession(raw, ctx);

  if (!session) {
    return fail(AppErrors.unauthorized("You must be signed in as an admin"));
  }

  if (permission && !can(session.user.permissions, permission)) {
    return fail(AppErrors.forbidden(`You don't have permission to ${permission}`));
  }

  return ok({ session });
}

/**
 * Build the privilege Actor (userId + role priority) for the signed-in admin.
 * A superuser (`*:*`) gets the highest priority.
 */
export async function actorFromSession(session: AdminSession): Promise<Actor> {
  if (session.user.permissions.includes("*:*")) {
    return { userId: session.user.id, rolePriority: Number.MAX_SAFE_INTEGER };
  }
  const role = await roleRepository.findById(session.user.roleId).catch(() => null);
  return { userId: session.user.id, rolePriority: role?.priority ?? 0 };
}
