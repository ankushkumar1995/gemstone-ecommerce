/**
 * Users domain — validation schemas (zod).
 *
 * `roleId` is a Mongo ObjectId (24 hex). Status covers the full lifecycle.
 */

import { z } from "zod";

const objectId = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{24}$/i, "invalid role id");

const statusEnum = z.enum(["active", "invited", "disabled", "suspended"]);

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  roleId: objectId,
  status: statusEnum.optional(),
  avatarColor: z.string().trim().max(20).optional(),
  /**
   * Temporary password. If omitted, the service auto-generates a strong one
   * and returns it ONCE so the admin can share it. The new user is forced to
   * change it on first login (mustChangePassword).
   */
  password: z.string().min(8).max(72).optional(),
});

/** Change own password (first-login forced, or from settings). */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).optional(), // optional on first-login set
  newPassword: z.string().min(8, "At least 8 characters").max(72),
});

/** Admin resets another user's password (returns a new temp password). */
export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(72).optional(), // omitted → auto-generate
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  roleId: objectId.optional(),
  status: statusEnum.optional(),
  avatarColor: z.string().trim().max(20).optional(),
  avatarUrl: z.string().trim().optional().or(z.literal("")),
});

export const setStatusSchema = z.object({
  status: statusEnum,
  reason: z.string().trim().max(240).optional(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type SetStatusDto = z.infer<typeof setStatusSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
