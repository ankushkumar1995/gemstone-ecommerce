/**
 * Customer-auth validation schemas (zod).
 */

import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.string().trim().email("Enter a valid email").max(180),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(180),
  password: z.string().min(1, "Enter your password").max(72),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(72),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(72),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(180),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(10, "Invalid reset token"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(72),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
