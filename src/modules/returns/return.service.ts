/**
 * Returns (RMA) domain — service. Creates returns from an order's line items,
 * walks the lifecycle, and on "refunded" restocks items + records the refund
 * on the order.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId, newReference } from "@/core/id";
import { orderService } from "@/modules/orders";
import { productService } from "@/modules/products";
import { auditService } from "@/modules/audit";
import { getReturnRepository } from "./return.repository";
import type {
  ReturnRequest,
  ReturnActivity,
  ReturnItem,
  ReturnStatus,
} from "./return.types";
import type { CreateReturnDto, UpdateReturnStatusDto } from "./return.schema";

const TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["received", "rejected"],
  received: ["refunded", "rejected"],
  refunded: [],
  rejected: [],
};

function logEntry(type: ReturnActivity["type"], message: string): ReturnActivity {
  return { id: newId("ract"), at: new Date().toISOString(), type, message, actor: "Admin" };
}

export const returnService = {
  async list(): Promise<Result<ReturnRequest[]>> {
    const repo = getReturnRepository();
    return ok(await repo.findAll());
  },

  async getById(id: string): Promise<Result<ReturnRequest>> {
    const repo = getReturnRepository();
    const r = await repo.findById(id);
    if (!r) return fail(AppErrors.notFound("Return not found"));
    return ok(r);
  },

  async listByOrder(orderId: string): Promise<Result<ReturnRequest[]>> {
    const repo = getReturnRepository();
    return ok(await repo.findByOrder(orderId));
  },

  async create(dto: CreateReturnDto): Promise<Result<ReturnRequest>> {
    const repo = getReturnRepository();
    const orderRes = await orderService.getById(dto.orderId);
    if (!orderRes.ok) return fail(AppErrors.validation("Order not found"));
    const order = orderRes.value;

    // only delivered/shipped orders can be returned
    if (!["shipped", "delivered"].includes(order.status)) {
      return fail(AppErrors.validation("Only shipped or delivered orders can be returned"));
    }

    // match requested items to order lines + validate qty
    const items: ReturnItem[] = [];
    for (const line of dto.items) {
      const orderLine = order.items.find(
        (it) => it.productId === line.productId && (it.variantId ?? "") === (line.variantId ?? "")
      );
      if (!orderLine) return fail(AppErrors.validation("Item not found in this order"));
      if (line.qty > orderLine.qty)
        return fail(AppErrors.validation(`Cannot return more than ${orderLine.qty} of ${orderLine.name}`));
      items.push({
        productId: orderLine.productId,
        variantId: orderLine.variantId,
        name: orderLine.name,
        image: orderLine.image,
        qty: line.qty,
        unitPrice: orderLine.unitPrice,
        lineRefund: orderLine.unitPrice * line.qty,
      });
    }

    const suggestedRefund = items.reduce((s, it) => s + it.lineRefund, 0);
    const now = new Date().toISOString();

    const ret: ReturnRequest = {
      id: newId("ret"),
      returnNumber: newReference("RMA"),
      orderId: order.id,
      orderNumber: order.orderNumber,
      customer: order.customer,
      customerId: order.customerId,
      items,
      reason: dto.reason,
      comment: dto.comment || undefined,
      status: "requested",
      suggestedRefund,
      restock: dto.restock ?? true,
      activity: [logEntry("created", "Return requested")],
      createdAt: now,
      updatedAt: now,
    };

    const createdReturn = await repo.create(ret);
    await auditService.record({
      action: "create",
      entity: "return",
      entityId: createdReturn.id,
      entityLabel: createdReturn.returnNumber,
      summary: `Return ${createdReturn.returnNumber} requested for ${createdReturn.orderNumber}`,
    });
    return ok(createdReturn);
  },

  async updateStatus(id: string, dto: UpdateReturnStatusDto): Promise<Result<ReturnRequest>> {
    const repo = getReturnRepository();
    const ret = await repo.findById(id);
    if (!ret) return fail(AppErrors.notFound("Return not found"));

    const next = dto.status;
    if (ret.status === next) return ok(ret);
    if (!TRANSITIONS[ret.status]?.includes(next)) {
      return fail(AppErrors.validation(`Cannot change return from "${ret.status}" to "${next}"`));
    }

    const patch: Partial<ReturnRequest> = {
      status: next,
      updatedAt: new Date().toISOString(),
    };
    const entries: ReturnActivity[] = [
      logEntry("status", `Return ${next}`),
    ];

    if (dto.restock !== undefined) patch.restock = dto.restock;

    // on refund: record amount, restock items, mark the order refunded-ish
    if (next === "refunded") {
      const amount = dto.refundAmount ?? ret.suggestedRefund;
      patch.refundAmount = amount;
      entries.push(logEntry("refund", `Refunded ₹${amount}`));

      const willRestock = dto.restock ?? ret.restock;
      if (willRestock) {
        for (const it of ret.items) {
          await productService.adjustStock(it.productId, it.qty, {
            variantId: it.variantId,
            reason: `return ${ret.returnNumber}`,
          });
        }
      }
      // leave an audit note on the order
      await orderService.addNote(
        ret.orderId,
        `Return ${ret.returnNumber} refunded ₹${amount}${willRestock ? " (restocked)" : ""}`
      );
    }

    patch.activity = [...entries, ...ret.activity].slice(0, 50);

    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Return not found"));
    await auditService.record({
      action: next === "refunded" ? "refund" : "status",
      entity: "return",
      entityId: updated.id,
      entityLabel: updated.returnNumber,
      summary:
        next === "refunded"
          ? `Return ${updated.returnNumber} refunded ₹${updated.refundAmount ?? updated.suggestedRefund}`
          : `Return ${updated.returnNumber}: ${next}`,
    });
    return ok(updated);
  },

  async addNote(id: string, note: string): Promise<Result<ReturnRequest>> {
    const repo = getReturnRepository();
    const ret = await repo.findById(id);
    if (!ret) return fail(AppErrors.notFound("Return not found"));
    const patch: Partial<ReturnRequest> = {
      activity: [logEntry("note", note.trim()), ...ret.activity].slice(0, 50),
    };
    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Return not found"));
    return ok(updated);
  },
};
