/**
 * Users domain — service (business logic + all production scenarios).
 *
 * Covers: create/invite, update, role change, status (activate/disable/
 * suspend), soft delete + restore, with the privilege & safety rules that keep
 * the panel from locking itself out or allowing escalation. Roles come from
 * the DB (roleRepository). Every mutation is audited. Returns Result<T>.
 *
 * Privilege model (enforced here, not just the UI):
 *  • always keep ≥1 active Owner
 *  • a user can't act on someone whose role priority ≥ their own
 *  • a user can't assign a role with priority ≥ their own (no escalation)
 *  • a user can't change their own role or delete/suspend themselves
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { cache } from "@/core/cache";
import { paginate, type ListParams, type Paginated } from "@/core/query";
import { hashPassword, verifyPassword, generatePassword, passwordIssue } from "@/core/password";
import { auditService } from "@/modules/audit";
import { getUserRepository } from "./user.repository";
import { roleRepository } from "./role.repository";
import { expandPermissions } from "./rbac";
import type { AdminUser, ResolvedUser, Role, UserStatus } from "./user.types";
import type { CreateUserDto, UpdateUserDto } from "./user.schema";

/** Create result includes the temp password ONCE (only when auto-generated). */
export interface CreatedUser {
  user: ResolvedUser;
  /** Present only when the password was auto-generated — show it to the admin once. */
  tempPassword?: string;
}

const OWNER_KEY = "owner";
const CACHE_TTL = 30;

function invalidate() {
  cache.delByPrefix("users:");
}

/** The acting admin's context for privilege checks. */
export interface Actor {
  userId: string;
  rolePriority: number;
}

/** Resolve a user with its role (from the given roles map) + permissions. */
function resolveWith(user: AdminUser, roles: Map<string, Role>): ResolvedUser {
  const role = roles.get(user.roleId);
  const effective: Role =
    role ??
    ({ id: user.roleId, key: "unknown", name: "Unknown", description: "", permissions: [], isSystem: false, priority: 0 } as Role);
  return { ...user, role: effective, permissions: expandPermissions(effective.permissions) };
}

export const userService = {
  /* ---------------- roles ---------------- */
  async listRoles(): Promise<Result<Role[]>> {
    return ok(await roleRepository.findAll());
  },

  /* ---------------- reads ---------------- */
  async list(): Promise<Result<ResolvedUser[]>> {
    const repo = getUserRepository();
    const [users, roles] = await Promise.all([repo.findAll(), roleRepository.map()]);
    return ok(users.map((u) => resolveWith(u, roles)));
  },

  /** Paginated + filtered + searchable listing for the admin table. */
  async listPaginated(params: ListParams & { status?: string; roleId?: string }): Promise<
    Result<Paginated<ResolvedUser>>
  > {
    const repo = getUserRepository();
    // Roles map + the page query in parallel; roles are cached.
    const [{ items, total }, roles] = await Promise.all([
      repo.search({
        skip: params.skip,
        limit: params.limit,
        sort: params.sort,
        q: params.q,
        status: params.status,
        roleId: params.roleId,
      }),
      roleRepository.map(),
    ]);
    return ok(paginate(items.map((u) => resolveWith(u, roles)), total, params));
  },

  async getById(id: string): Promise<Result<ResolvedUser>> {
    const repo = getUserRepository();
    const u = await repo.findById(id);
    if (!u) return fail(AppErrors.notFound("User not found"));
    const roles = await roleRepository.map();
    return ok(resolveWith(u, roles));
  },

  async getByEmail(email: string): Promise<Result<ResolvedUser>> {
    const repo = getUserRepository();
    const u = await repo.findByEmail(email);
    if (!u) return fail(AppErrors.notFound("User not found"));
    const roles = await roleRepository.map();
    return ok(resolveWith(u, roles));
  },

  /* ---------------- helpers ---------------- */
  /** How many active Owners remain (optionally excluding one user)? */
  async _activeOwnerCount(ownerRoleId: string, exceptUserId?: string): Promise<number> {
    const repo = getUserRepository();
    const all = await repo.findAll();
    return all.filter((u) => u.roleId === ownerRoleId && u.status === "active" && u.id !== exceptUserId).length;
  },

  /* ---------------- create (with temp password) ---------------- */
  async create(dto: CreateUserDto, actor?: Actor): Promise<Result<CreatedUser>> {
    const repo = getUserRepository();
    const roles = await roleRepository.map();

    const role = roles.get(dto.roleId);
    if (!role) return fail(AppErrors.validation("Unknown role"));

    // No escalation: can't create someone at or above your own power.
    if (actor && role.priority >= actor.rolePriority) {
      return fail(AppErrors.forbidden("You cannot assign a role equal to or above your own"));
    }

    if (await repo.emailTakenBy(dto.email)) {
      return fail(AppErrors.conflict("A user with this email already exists"));
    }

    // Password: use the admin-provided one, else auto-generate a strong temp.
    let tempPassword: string | undefined;
    let plain = dto.password;
    if (plain) {
      const issue = passwordIssue(plain);
      if (issue) return fail(AppErrors.validation(issue));
    } else {
      plain = generatePassword();
      tempPassword = plain; // returned once so the admin can share it
    }
    const passwordHash = await hashPassword(plain);

    const created = await repo.create({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone,
      roleId: dto.roleId,
      // A user with a password is active and must change it on first login.
      status: dto.status ?? "active",
      avatarColor: dto.avatarColor,
      invitedBy: actor?.userId,
      createdBy: actor?.userId,
      passwordHash,
      mustChangePassword: true,
    });
    invalidate();
    await auditService.record({
      action: "create",
      entity: "user",
      entityId: created.id,
      entityLabel: created.email,
      summary: `Added admin user "${created.name}" (${role.name})`,
    });
    return ok({ user: resolveWith(created, roles), tempPassword });
  },

  /* ---------------- update (name/phone/avatar + role + status) ---------------- */
  async update(id: string, dto: UpdateUserDto, actor?: Actor): Promise<Result<ResolvedUser>> {
    const repo = getUserRepository();
    const roles = await roleRepository.map();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("User not found"));

    const existingRole = roles.get(existing.roleId);
    const ownerRole = [...roles.values()].find((r) => r.key === OWNER_KEY);

    // Privilege: can't act on someone at or above your own power.
    if (actor && existingRole && existingRole.priority >= actor.rolePriority && existing.id !== actor.userId) {
      return fail(AppErrors.forbidden("You cannot modify a user with an equal or higher role"));
    }

    // Role change rules.
    if (dto.roleId && dto.roleId !== existing.roleId) {
      const newRole = roles.get(dto.roleId);
      if (!newRole) return fail(AppErrors.validation("Unknown role"));
      if (actor && existing.id === actor.userId) {
        return fail(AppErrors.forbidden("You cannot change your own role"));
      }
      if (actor && newRole.priority >= actor.rolePriority) {
        return fail(AppErrors.forbidden("You cannot assign a role equal to or above your own"));
      }
      // Demoting the last Owner?
      if (ownerRole && existing.roleId === ownerRole.id) {
        if ((await this._activeOwnerCount(ownerRole.id, id)) === 0) {
          return fail(AppErrors.forbidden("There must be at least one active Owner"));
        }
      }
    }

    // Disabling/suspending the last Owner?
    if (dto.status && dto.status !== "active" && ownerRole && existing.roleId === ownerRole.id) {
      if ((await this._activeOwnerCount(ownerRole.id, id)) === 0) {
        return fail(AppErrors.forbidden("There must be at least one active Owner"));
      }
    }

    const patch: Partial<AdminUser> = {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.roleId !== undefined && { roleId: dto.roleId }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.avatarColor !== undefined && { avatarColor: dto.avatarColor }),
      ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
    };
    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("User not found"));
    invalidate();
    await auditService.record({
      action: "update",
      entity: "user",
      entityId: updated.id,
      entityLabel: updated.email,
      summary: `Updated admin user "${updated.name}"`,
    });
    return ok(resolveWith(updated, roles));
  },

  /* ---------------- status (activate / disable / suspend) ---------------- */
  async setStatus(
    id: string,
    status: UserStatus,
    opts?: { reason?: string; actor?: Actor },
  ): Promise<Result<ResolvedUser>> {
    const repo = getUserRepository();
    const roles = await roleRepository.map();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("User not found"));

    const actor = opts?.actor;
    if (actor && existing.id === actor.userId && status !== "active") {
      return fail(AppErrors.forbidden("You cannot disable or suspend yourself"));
    }
    const existingRole = roles.get(existing.roleId);
    if (actor && existingRole && existingRole.priority >= actor.rolePriority && existing.id !== actor.userId) {
      return fail(AppErrors.forbidden("You cannot change the status of a user with an equal or higher role"));
    }
    const ownerRole = [...roles.values()].find((r) => r.key === OWNER_KEY);
    if (status !== "active" && ownerRole && existing.roleId === ownerRole.id) {
      if ((await this._activeOwnerCount(ownerRole.id, id)) === 0) {
        return fail(AppErrors.forbidden("There must be at least one active Owner"));
      }
    }

    const patch: Partial<AdminUser> = { status };
    if (status === "suspended") {
      patch.suspendedReason = opts?.reason ?? "";
      patch.suspendedAt = new Date().toISOString();
    }
    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("User not found"));
    invalidate();
    await auditService.record({
      action: "status",
      entity: "user",
      entityId: updated.id,
      entityLabel: updated.email,
      summary: `Set "${updated.name}" to ${status}${opts?.reason ? ` (${opts.reason})` : ""}`,
    });
    return ok(resolveWith(updated, roles));
  },

  /* ---------------- delete (soft) ---------------- */
  async remove(id: string, actor?: Actor): Promise<Result<{ id: string }>> {
    const repo = getUserRepository();
    const roles = await roleRepository.map();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("User not found"));

    if (actor && existing.id === actor.userId) {
      return fail(AppErrors.forbidden("You cannot delete your own account"));
    }
    const existingRole = roles.get(existing.roleId);
    if (actor && existingRole && existingRole.priority >= actor.rolePriority) {
      return fail(AppErrors.forbidden("You cannot delete a user with an equal or higher role"));
    }
    const ownerRole = [...roles.values()].find((r) => r.key === OWNER_KEY);
    if (ownerRole && existing.roleId === ownerRole.id) {
      if ((await this._activeOwnerCount(ownerRole.id, id)) === 0) {
        return fail(AppErrors.forbidden("You cannot delete the last Owner"));
      }
    }

    const removed = await repo.remove(id, actor?.userId);
    if (!removed) return fail(AppErrors.notFound("User not found"));
    invalidate();
    await auditService.record({
      action: "delete",
      entity: "user",
      entityId: id,
      entityLabel: existing.email,
      summary: `Removed admin user "${existing.name}"`,
    });
    return ok({ id });
  },

  /* ---------------- restore ---------------- */
  async restore(id: string): Promise<Result<ResolvedUser>> {
    const repo = getUserRepository();
    const restored = await repo.restore(id);
    if (!restored) return fail(AppErrors.notFound("Deleted user not found"));
    invalidate();
    const roles = await roleRepository.map();
    await auditService.record({
      action: "update",
      entity: "user",
      entityId: restored.id,
      entityLabel: restored.email,
      summary: `Restored admin user "${restored.name}"`,
    });
    return ok(resolveWith(restored, roles));
  },

  /* ---------------- unlock (clear brute-force lockout) ---------------- */
  async unlock(id: string, actor?: Actor): Promise<Result<ResolvedUser>> {
    const repo = getUserRepository();
    const roles = await roleRepository.map();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("User not found"));

    const existingRole = roles.get(existing.roleId);
    if (actor && existingRole && existingRole.priority >= actor.rolePriority && existing.id !== actor.userId) {
      return fail(AppErrors.forbidden("You cannot unlock a user with an equal or higher role"));
    }

    const done = await repo.unlock(id);
    if (!done) return fail(AppErrors.notFound("User not found"));
    invalidate();
    await auditService.record({
      action: "status",
      entity: "user",
      entityId: id,
      entityLabel: existing.email,
      summary: `Unlocked "${existing.name}" (cleared failed-login lockout)`,
    });
    const refreshed = await repo.findById(id);
    return ok(resolveWith(refreshed ?? existing, roles));
  },

  /* ---------------- passwords ---------------- */

  /**
   * Admin resets another user's password. Returns the new temp password once
   * (when auto-generated) so the admin can share it. Forces change on next login.
   */
  async resetPassword(id: string, newPassword?: string, actor?: Actor): Promise<Result<{ tempPassword?: string }>> {
    const repo = getUserRepository();
    const roles = await roleRepository.map();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("User not found"));

    const existingRole = roles.get(existing.roleId);
    if (actor && existingRole && existingRole.priority >= actor.rolePriority && existing.id !== actor.userId) {
      return fail(AppErrors.forbidden("You cannot reset the password of a user with an equal or higher role"));
    }

    let tempPassword: string | undefined;
    let plain = newPassword;
    if (plain) {
      const issue = passwordIssue(plain);
      if (issue) return fail(AppErrors.validation(issue));
    } else {
      plain = generatePassword();
      tempPassword = plain;
    }
    const hash = await hashPassword(plain);
    const okRes = await repo.setPassword(id, hash, true);
    if (!okRes) return fail(AppErrors.notFound("User not found"));
    invalidate();
    await auditService.record({
      action: "update",
      entity: "user",
      entityId: id,
      entityLabel: existing.email,
      summary: `Reset password for "${existing.name}"`,
    });
    return ok({ tempPassword });
  },

  /**
   * A user changes their own password. On a forced first-login change,
   * `currentPassword` may be omitted (the mustChangePassword flag gates it).
   */
  async changePassword(
    userId: string,
    newPassword: string,
    currentPassword?: string,
  ): Promise<Result<{ changed: true }>> {
    const repo = getUserRepository();
    const auth = await repo.findForAuth((await repo.findById(userId))?.email ?? "");
    if (!auth || auth.id !== userId) return fail(AppErrors.notFound("User not found"));

    // If not a forced first-login change, verify the current password.
    if (!auth.mustChangePassword) {
      if (!currentPassword || !(await verifyPassword(currentPassword, auth.passwordHash))) {
        return fail(AppErrors.unauthorized("Current password is incorrect"));
      }
    }
    const issue = passwordIssue(newPassword);
    if (issue) return fail(AppErrors.validation(issue));

    const hash = await hashPassword(newPassword);
    await repo.setPassword(userId, hash, false);
    // Kill every existing session (all devices) — password changed.
    await repo.bumpTokenVersion(userId);
    invalidate();
    await auditService.record({
      action: "update",
      entity: "user",
      entityId: userId,
      entityLabel: auth.email,
      summary: `Password changed for "${auth.name}"`,
    });
    return ok({ changed: true });
  },

  /**
   * Verify email + password for login. Returns the resolved user (with role +
   * permissions) on success, or a safe error. Enforces status + lockout and
   * records failed/successful attempts (brute-force protection).
   */
  async authenticate(
    email: string,
    password: string,
    ip?: string,
  ): Promise<Result<ResolvedUser & { mustChangePassword: boolean }>> {
    const repo = getUserRepository();
    const auth = await repo.findForAuth(email.trim().toLowerCase());
    // Same generic error whether the email exists or not (no enumeration).
    if (!auth) return fail(AppErrors.unauthorized("Invalid email or password"));

    // Locked out?
    if (auth.lockedUntil && new Date(auth.lockedUntil) > new Date()) {
      return fail(AppErrors.forbidden("Account temporarily locked due to failed attempts. Try again later."));
    }
    // Not usable?
    if (auth.status === "disabled" || auth.status === "suspended") {
      return fail(AppErrors.forbidden("This account is not active. Contact an Owner."));
    }

    const okPw = await verifyPassword(password, auth.passwordHash);
    if (!okPw) {
      // Count the failure; lock after the threshold.
      const next = (auth.failedLoginCount ?? 0) + 1;
      const lockUntil = next >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null;
      await repo.recordFailedLogin(auth.id, lockUntil ? 0 : next, lockUntil);
      if (lockUntil) {
        await auditService.record({
          action: "status",
          entity: "user",
          entityId: auth.id,
          entityLabel: auth.email,
          summary: `Account locked after ${MAX_FAILED_LOGINS} failed login attempts`,
        });
        return fail(AppErrors.forbidden("Too many failed attempts. Account locked for 15 minutes."));
      }
      return fail(AppErrors.unauthorized("Invalid email or password"));
    }

    // Success — reset counters, stamp last login.
    await repo.recordSuccessfulLogin(auth.id, ip ?? null);
    const roles = await roleRepository.map();
    const resolved = resolveWith(auth, roles);
    return ok({ ...resolved, mustChangePassword: Boolean(auth.mustChangePassword) });
  },
};

/** Brute-force policy. */
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
