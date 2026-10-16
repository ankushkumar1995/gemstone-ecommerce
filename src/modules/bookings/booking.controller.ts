/**
 * Service Bookings domain — controller. Validates input and bridges HTTP ⇄
 * service.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import {
  createBookingSchema,
  updateBookingStatusSchema,
  updateBookingPaymentSchema,
  scheduleBookingSchema,
  bookingNoteSchema,
  bookingAdminNotesSchema,
} from "./booking.schema";
import { bookingService } from "./booking.service";
import type { Booking } from "./booking.types";

export const bookingController = {
  async list(): Promise<NextResponse<ApiResponse<Booking[]>>> {
    return toResponse(await bookingService.list());
  },

  async get(id: string): Promise<NextResponse<ApiResponse<Booking>>> {
    return toResponse(await bookingService.getById(id));
  },

  async counts(): Promise<NextResponse<ApiResponse<{ pending: number; active: number; total: number }>>> {
    return toResponse(await bookingService.counts());
  },

  async create(body: unknown): Promise<NextResponse<ApiResponse<Booking>>> {
    const parsed = parse(createBookingSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await bookingService.create(parsed.value), 201);
  },

  async updateStatus(id: string, body: unknown): Promise<NextResponse<ApiResponse<Booking>>> {
    const parsed = parse(updateBookingStatusSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await bookingService.updateStatus(id, parsed.value.status));
  },

  async updatePayment(id: string, body: unknown): Promise<NextResponse<ApiResponse<Booking>>> {
    const parsed = parse(updateBookingPaymentSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await bookingService.updatePayment(id, parsed.value.paymentStatus));
  },

  async schedule(id: string, body: unknown): Promise<NextResponse<ApiResponse<Booking>>> {
    const parsed = parse(scheduleBookingSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await bookingService.schedule(id, parsed.value.scheduledAt));
  },

  async setAdminNotes(id: string, body: unknown): Promise<NextResponse<ApiResponse<Booking>>> {
    const parsed = parse(bookingAdminNotesSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await bookingService.setAdminNotes(id, parsed.value.adminNotes ?? ""));
  },

  async addNote(id: string, body: unknown): Promise<NextResponse<ApiResponse<Booking>>> {
    const parsed = parse(bookingNoteSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await bookingService.addNote(id, parsed.value.note));
  },

  async remove(id: string): Promise<NextResponse<ApiResponse<{ id: string }>>> {
    return toResponse(await bookingService.remove(id));
  },
};
