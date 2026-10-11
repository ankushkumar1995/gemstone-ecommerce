/**
 * Orders domain — controller. Validates input and bridges HTTP ⇄ service.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import {
  createOrderSchema,
  updateStatusSchema,
  updatePaymentSchema,
  updateFulfillmentSchema,
  updateOrderDetailsSchema,
  addOrderNoteSchema,
} from "./order.schema";
import { orderService } from "./order.service";
import type { Order } from "./order.types";

export const orderController = {
  async list(): Promise<NextResponse<ApiResponse<Order[]>>> {
    return toResponse(await orderService.list());
  },

  async get(id: string): Promise<NextResponse<ApiResponse<Order>>> {
    return toResponse(await orderService.getById(id));
  },

  async create(body: unknown): Promise<NextResponse<ApiResponse<Order>>> {
    const parsed = parse(createOrderSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await orderService.create(parsed.value), 201);
  },

  async updateStatus(id: string, body: unknown): Promise<NextResponse<ApiResponse<Order>>> {
    const parsed = parse(updateStatusSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await orderService.updateStatus(id, parsed.value.status));
  },

  async updatePayment(id: string, body: unknown): Promise<NextResponse<ApiResponse<Order>>> {
    const parsed = parse(updatePaymentSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await orderService.updatePayment(id, parsed.value.paymentStatus));
  },

  async updateFulfillment(id: string, body: unknown): Promise<NextResponse<ApiResponse<Order>>> {
    const parsed = parse(updateFulfillmentSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await orderService.updateFulfillment(id, parsed.value));
  },

  async addNote(id: string, body: unknown): Promise<NextResponse<ApiResponse<Order>>> {
    const parsed = parse(addOrderNoteSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await orderService.addNote(id, parsed.value.note));
  },

  async updateDetails(id: string, body: unknown): Promise<NextResponse<ApiResponse<Order>>> {
    const parsed = parse(updateOrderDetailsSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await orderService.updateDetails(id, parsed.value));
  },
};
