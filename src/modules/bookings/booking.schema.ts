/**
 * Service Bookings domain — validation schemas (zod).
 */

import { z } from "zod";

const intakeSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter the full name").max(120),
  phone: z.string().trim().min(6, "Please enter a valid phone").max(30),
  dob: z.string().trim().max(20).optional().or(z.literal("")),
  birthTime: z.string().trim().max(20).optional().or(z.literal("")),
  birthPlace: z.string().trim().max(160).optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other", ""]).optional(),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const createBookingSchema = z.object({
  serviceId: z.string().trim().min(1, "Service is required"),
  // customerId is ignored from the body — derived from the session server-side.
  customerId: z.string().trim().optional(),
  customer: z
    .object({
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().email(),
      phone: z.string().trim().max(30).optional().or(z.literal("")),
    })
    .optional(),
  intake: intakeSchema,
  preferredAt: z.string().trim().optional().or(z.literal("")),
  paymentMethod: z.enum(["razorpay", "cod", "manual"]).optional(),
  paymentStatus: z.enum(["unpaid", "paid", "refunded"]).optional(),
  status: z
    .enum(["pending", "confirmed", "in_progress", "completed", "cancelled", "refunded"])
    .optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled", "refunded"]),
});

export const updateBookingPaymentSchema = z.object({
  paymentStatus: z.enum(["unpaid", "paid", "refunded"]),
});

export const scheduleBookingSchema = z.object({
  scheduledAt: z.string().trim().min(1, "Pick a date & time"),
});

export const bookingNoteSchema = z.object({
  note: z.string().trim().min(1, "Note cannot be empty").max(2000),
});

export const bookingAdminNotesSchema = z.object({
  adminNotes: z.string().trim().max(4000).optional().or(z.literal("")),
});

export type CreateBookingDto = z.infer<typeof createBookingSchema>;
export type UpdateBookingStatusDto = z.infer<typeof updateBookingStatusSchema>;
export type UpdateBookingPaymentDto = z.infer<typeof updateBookingPaymentSchema>;
export type ScheduleBookingDto = z.infer<typeof scheduleBookingSchema>;
export type BookingNoteDto = z.infer<typeof bookingNoteSchema>;
export type BookingAdminNotesDto = z.infer<typeof bookingAdminNotesSchema>;
