/**
 * Users domain — controller. Thin HTTP adapter over userService. The `actor`
 * (the logged-in admin's id + role priority) is passed through so the service
 * can enforce privilege rules.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import { parseListParams, type Paginated } from "@/core/query";
import {
  createUserSchema,
  updateUserSchema,
  setStatusSchema,
  changePasswordSchema,
  resetPasswordSchema,
} from "./user.schema";
import { userService, type Actor, type CreatedUser } from "./user.service";
import type { ResolvedUser, Role } from "./user.types";

const SORTABLE = ["name", "email", "status", "createdAt", "updatedAt", "lastLoginAt"];

export const userController = {
  async list(): Promise<NextResponse<ApiResponse<ResolvedUser[]>>> {
    return toResponse(await userService.list());
  },

  async listPaginated(
    searchParams: URLSearchParams,
  ): Promise<NextResponse<ApiResponse<Paginated<ResolvedUser>>>> {
    const params = parseListParams(searchParams, {
      defaultSort: { createdAt: -1 },
      allowedSortKeys: SORTABLE,
    });
    const status = searchParams.get("status") ?? undefined;
    const roleId = searchParams.get("roleId") ?? undefined;
    return toResponse(await userService.listPaginated({ ...params, status, roleId }));
  },

  async get(id: string): Promise<NextResponse<ApiResponse<ResolvedUser>>> {
    return toResponse(await userService.getById(id));
  },

  async create(body: unknown, actor?: Actor): Promise<NextResponse<ApiResponse<CreatedUser>>> {
    const parsed = parse(createUserSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await userService.create(parsed.value, actor), 201);
  },

  async resetPassword(id: string, body: unknown, actor?: Actor): Promise<NextResponse<ApiResponse<{ tempPassword?: string }>>> {
    const parsed = parse(resetPasswordSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await userService.resetPassword(id, parsed.value.password, actor));
  },

  async changePassword(userId: string, body: unknown): Promise<NextResponse<ApiResponse<{ changed: true }>>> {
    const parsed = parse(changePasswordSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await userService.changePassword(userId, parsed.value.newPassword, parsed.value.currentPassword));
  },

  async update(id: string, body: unknown, actor?: Actor): Promise<NextResponse<ApiResponse<ResolvedUser>>> {
    const parsed = parse(updateUserSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await userService.update(id, parsed.value, actor));
  },

  async setStatus(id: string, body: unknown, actor?: Actor): Promise<NextResponse<ApiResponse<ResolvedUser>>> {
    const parsed = parse(setStatusSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(
      await userService.setStatus(id, parsed.value.status, { reason: parsed.value.reason, actor }),
    );
  },

  async remove(id: string, actor?: Actor): Promise<NextResponse<ApiResponse<{ id: string }>>> {
    return toResponse(await userService.remove(id, actor));
  },

  async restore(id: string): Promise<NextResponse<ApiResponse<ResolvedUser>>> {
    return toResponse(await userService.restore(id));
  },

  async unlock(id: string, actor?: Actor): Promise<NextResponse<ApiResponse<ResolvedUser>>> {
    return toResponse(await userService.unlock(id, actor));
  },

  async listRoles(): Promise<NextResponse<ApiResponse<Role[]>>> {
    return toResponse(await userService.listRoles());
  },
};
