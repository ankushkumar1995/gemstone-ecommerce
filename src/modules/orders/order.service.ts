/**
 * Orders domain — service (business logic). The hub that ties products,
 * customers, stock and payment together.
 *
 * Stock policy (Option A): stock is COMMITTED (decremented) the moment an
 * order reaches "confirmed" (or is created already-confirmed), and RELEASED
 * (restocked) if the order is later cancelled or refunded. "pending" orders
 * do not hold stock.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId, newReference } from "@/core/id";
import { productService } from "@/modules/products";
import { customerService } from "@/modules/customers";
import { couponService } from "@/modules/coupons";
import { auditService } from "@/modules/audit";
import { settingsService } from "@/modules/settings";
import { getOrderRepository } from "./order.repository";
import type {
  Order,
  OrderActivity,
  OrderItem,
  OrderStatus,
  PaymentStatus,
} from "./order.types";
import type {
  CreateOrderDto,
  UpdateFulfillmentDto,
} from "./order.schema";

/** Statuses in which stock is considered committed (decremented). */
const STOCK_COMMITTED: OrderStatus[] = ["confirmed", "packed", "shipped", "delivered"];
/** Statuses that release committed stock back to inventory. */
const STOCK_RELEASED: OrderStatus[] = ["cancelled", "refunded"];

/** Allowed status transitions — guards against illegal jumps. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled", "refunded"],
  packed: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

function logEntry(type: OrderActivity["type"], message: string): OrderActivity {
  return { id: newId("oact"), at: new Date().toISOString(), type, message, actor: "Admin" };
}

function isCommitted(status: OrderStatus): boolean {
  return STOCK_COMMITTED.includes(status);
}

export const orderService = {
  async list(): Promise<Result<Order[]>> {
    const repo = getOrderRepository();
    return ok(await repo.findAll());
  },

  async getById(id: string): Promise<Result<Order>> {
    const repo = getOrderRepository();
    const o = await repo.findById(id);
    if (!o) return fail(AppErrors.notFound("Order not found"));
    return ok(o);
  },

  /** All orders belonging to a single customer, newest first. */
  async listByCustomer(customerId: string): Promise<Result<Order[]>> {
    const repo = getOrderRepository();
    return ok(await repo.findByCustomer(customerId));
  },

  /**
   * Customer self-service cancel. Ownership is enforced (the order must belong
   * to this customer) and only PRE-SHIP orders (pending/confirmed) can be
   * cancelled by the customer — once packed/shipped they must contact support.
   * Reuses updateStatus so stock is restocked + stats reverted correctly.
   */
  async cancelByCustomer(orderId: string, customerId: string): Promise<Result<Order>> {
    const repo = getOrderRepository();
    const order = await repo.findById(orderId);
    if (!order) return fail(AppErrors.notFound("Order not found"));
    if (order.customerId !== customerId) {
      return fail(AppErrors.forbidden("This order doesn't belong to your account"));
    }
    if (!["pending", "confirmed"].includes(order.status)) {
      return fail(
        AppErrors.validation(
          "This order can no longer be cancelled online. Please contact support.",
        ),
      );
    }
    return this.updateStatus(orderId, "cancelled");
  },

  /** Find an order by its gateway (Razorpay) order id — for verify/webhook. */
  async findByRazorpayOrderId(razorpayOrderId: string): Promise<Order | null> {
    const repo = getOrderRepository();
    return repo.findByRazorpayOrderId(razorpayOrderId);
  },

  /** Attach the gateway order id to a freshly-created pending order. */
  async attachRazorpayOrder(orderId: string, razorpayOrderId: string): Promise<void> {
    const repo = getOrderRepository();
    const order = await repo.findById(orderId);
    if (!order) return;
    await repo.update(orderId, {
      payment: { ...(order.payment ?? { provider: "razorpay" }), provider: "razorpay", razorpayOrderId },
    });
  },

  /**
   * Mark an online-payment order as PAID after its signature has been verified
   * by the caller. Idempotent: if the order is already paid it's a no-op (so a
   * client callback + webhook racing can't double-commit stock or stats).
   *
   * On first success it stores the gateway refs, flips paymentStatus→paid, and
   * transitions pending→confirmed (which commits stock + records the order on
   * the customer via the normal lifecycle).
   */
  async markPaid(
    orderId: string,
    refs: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature?: string },
  ): Promise<Result<Order>> {
    const repo = getOrderRepository();
    const order = await repo.findById(orderId);
    if (!order) return fail(AppErrors.notFound("Order not found"));

    // Idempotency guard — already settled.
    if (order.paymentStatus === "paid") return ok(order);

    // Persist the gateway refs + payment status first.
    await repo.update(orderId, {
      paymentStatus: "paid",
      payment: {
        provider: "razorpay",
        razorpayOrderId: refs.razorpayOrderId,
        razorpayPaymentId: refs.razorpayPaymentId,
        razorpaySignature: refs.razorpaySignature,
        paidAt: new Date().toISOString(),
      },
      activity: [logEntry("payment", "Payment captured via Razorpay"), ...order.activity].slice(0, 50),
    });

    // Transition pending → confirmed to commit stock + customer stats. If the
    // order was already in a committed state, leave the status as-is.
    if (order.status === "pending") {
      const confirmed = await this.updateStatus(orderId, "confirmed");
      if (!confirmed.ok) return confirmed;
      return confirmed;
    }
    const fresh = await repo.findById(orderId);
    return fresh ? ok(fresh) : fail(AppErrors.notFound("Order not found"));
  },

  /**
   * Create an order. Builds line items from live product snapshots, computes
   * pricing, commits stock + records the customer if the order is created in
   * a committed status.
   */
  async create(dto: CreateOrderDto): Promise<Result<Order>> {
    const repo = getOrderRepository();

    // resolve customer identity (snapshot)
    let customerSnap = dto.customer;
    if (dto.customerId) {
      const cRes = await customerService.getById(dto.customerId);
      if (!cRes.ok) return fail(AppErrors.validation("Selected customer not found"));
      customerSnap = { name: cRes.value.name, email: cRes.value.email, phone: cRes.value.phone };
    }
    if (!customerSnap) {
      return fail(AppErrors.validation("Provide a customer or guest details"));
    }

    // Store settings are the source of truth for tax, shipping, qty limits and
    // the order-number prefix (callers may still override tax/shipping per order).
    const settingsRes = await settingsService.get();
    const settings = settingsRes.ok ? settingsRes.value : null;
    const minQty = settings?.order.minQtyPerItem ?? 1;
    const maxQty = settings?.order.maxQtyPerItem ?? 0; // 0 = no max

    // build items from product snapshots + validate stock availability
    const items: OrderItem[] = [];
    for (const line of dto.items) {
      // enforce per-item quantity limits from settings
      if (line.qty < minQty) {
        return fail(AppErrors.validation(`Minimum quantity per item is ${minQty}`));
      }
      if (maxQty > 0 && line.qty > maxQty) {
        return fail(AppErrors.validation(`Maximum quantity per item is ${maxQty}`));
      }

      const pRes = await productService.getById(line.productId);
      if (!pRes.ok) return fail(AppErrors.validation(`Product ${line.productId} not found`));
      const p = pRes.value;

      let unitPrice = p.price;
      let variantLabel: string | undefined;
      let sku = p.sku;
      let available = p.stockQty ?? 0;

      if (line.variantId) {
        const v = p.variants?.find((x) => x.id === line.variantId);
        if (!v) return fail(AppErrors.validation(`Variant not found for ${p.name}`));
        unitPrice = v.price;
        variantLabel = v.label;
        sku = v.sku ?? sku;
        available = v.stockQty;
      }

      items.push({
        productId: p.id,
        variantId: line.variantId,
        name: p.name,
        image: p.image,
        sku,
        variantLabel,
        unitPrice,
        qty: line.qty,
        lineTotal: unitPrice * line.qty,
      });

      // availability only matters when we are about to commit stock
      const committing = isCommitted(dto.status ?? "pending");
      if (committing && line.qty > available) {
        return fail(AppErrors.validation(`Not enough stock for ${p.name} (have ${available})`));
      }
    }

    // pricing — driven by store settings, with per-order overrides allowed
    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
    const discount = dto.discount ?? 0;
    const taxable = Math.max(0, subtotal - discount);

    // enforce minimum order value from checkout settings (on the taxable amount)
    const minOrderValue = settings?.checkout.minOrderValue ?? 0;
    if (minOrderValue > 0 && taxable < minOrderValue) {
      return fail(
        AppErrors.validation(`Minimum order value is ₹${minOrderValue.toLocaleString("en-IN")}`),
      );
    }

    // Shipping: explicit override wins; else compute from settings
    // (free at/above the threshold, otherwise the flat rate).
    let shipping: number;
    if (dto.shipping !== undefined) {
      shipping = dto.shipping;
    } else if (settings) {
      const { freeShippingThreshold, flatRate } = settings.shipping;
      shipping = freeShippingThreshold > 0 && taxable >= freeShippingThreshold ? 0 : flatRate;
    } else {
      shipping = 0;
    }

    // Tax: explicit taxRate override wins; else the settings GST rate.
    const taxRate = dto.taxRate ?? settings?.tax.rate ?? 0;
    const tax = taxRate ? Math.round((taxable * taxRate) / 100) : 0;
    const grandTotal = taxable + shipping + tax;

    const now = new Date().toISOString();
    const status = dto.status ?? "pending";

    // order-number prefix comes from store settings (falls back to "NK")
    const prefix = settings?.order.numberPrefix ?? "NK";

    const order: Order = {
      id: newId("ord"),
      orderNumber: newReference(prefix),
      customerId: dto.customerId,
      customer: customerSnap,
      items,
      pricing: {
        subtotal,
        discount,
        couponCode: dto.couponCode || undefined,
        shipping,
        tax,
        grandTotal,
      },
      shippingAddress: dto.shippingAddress,
      billingAddress: dto.billingAddress,
      status,
      paymentStatus: dto.paymentStatus ?? "unpaid",
      paymentMethod: dto.paymentMethod ?? "cod",
      fulfillment: {},
      notes: dto.notes || undefined,
      activity: [logEntry("created", `Order placed (${status})`)],
      placedAt: now,
      updatedAt: now,
    };

    const created = await repo.create(order);

    // side-effects if created already-committed
    if (isCommitted(status)) {
      await this.commitStock(created, -1);
      if (created.customerId) {
        await customerService.recordOrder(
          created.customerId,
          created.pricing.grandTotal,
          created.orderNumber,
          created.placedAt
        );
      }
      if (created.pricing.couponCode) {
        await couponService.recordUsage(created.pricing.couponCode, created.pricing.subtotal, {
          customerId: created.customerId,
          orderNumber: created.orderNumber,
        });
      }
    }

    await auditService.record({
      action: "create",
      entity: "order",
      entityId: created.id,
      entityLabel: created.orderNumber,
      summary: `Order ${created.orderNumber} placed (${status})`,
    });
    return ok(created);
  },

  /**
   * Change order status with transition validation and the right stock /
   * customer side-effects (commit on first confirm, release on cancel/refund).
   */
  async updateStatus(id: string, next: OrderStatus): Promise<Result<Order>> {
    const repo = getOrderRepository();
    const order = await repo.findById(id);
    if (!order) return fail(AppErrors.notFound("Order not found"));

    const current = order.status;
    if (current === next) return ok(order);
    if (!TRANSITIONS[current]?.includes(next)) {
      return fail(AppErrors.validation(`Cannot change status from "${current}" to "${next}"`));
    }
    if (next === "shipped" && !order.fulfillment.trackingNumber) {
      return fail(AppErrors.validation("Add a tracking number before marking shipped"));
    }

    const wasCommitted = isCommitted(current);
    const willCommit = isCommitted(next);

    // commit stock when entering committed state the first time
    if (!wasCommitted && willCommit) {
      await this.commitStock(order, -1);
      if (order.customerId) {
        await customerService.recordOrder(
          order.customerId,
          order.pricing.grandTotal,
          order.orderNumber,
          order.placedAt
        );
      }
      if (order.pricing.couponCode) {
        await couponService.recordUsage(order.pricing.couponCode, order.pricing.subtotal, {
          customerId: order.customerId,
          orderNumber: order.orderNumber,
        });
      }
    }
    // release stock when leaving a committed state into cancel/refund
    if (wasCommitted && STOCK_RELEASED.includes(next)) {
      await this.commitStock(order, +1);
      if (order.customerId) {
        await customerService.revertOrder(order.customerId, order.pricing.grandTotal, order.orderNumber);
      }
    }

    const patch: Partial<Order> = {
      status: next,
      updatedAt: new Date().toISOString(),
      activity: [logEntry("status", `Status changed from "${current}" to "${next}"`), ...order.activity].slice(0, 50),
    };
    if (next === "delivered") {
      patch.fulfillment = { ...order.fulfillment, deliveredAt: new Date().toISOString() };
    }
    if (next === "refunded") patch.paymentStatus = "refunded";

    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Order not found"));
    await auditService.record({
      action: next === "refunded" ? "refund" : "status",
      entity: "order",
      entityId: updated.id,
      entityLabel: updated.orderNumber,
      summary: `Order ${updated.orderNumber}: ${current} → ${next}`,
    });
    return ok(updated);
  },

  async updatePayment(id: string, paymentStatus: PaymentStatus): Promise<Result<Order>> {
    const repo = getOrderRepository();
    const order = await repo.findById(id);
    if (!order) return fail(AppErrors.notFound("Order not found"));
    const patch: Partial<Order> = {
      paymentStatus,
      updatedAt: new Date().toISOString(),
      activity: [logEntry("payment", `Payment marked "${paymentStatus}"`), ...order.activity].slice(0, 50),
    };
    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Order not found"));
    await auditService.record({
      action: "payment",
      entity: "order",
      entityId: updated.id,
      entityLabel: updated.orderNumber,
      summary: `Order ${updated.orderNumber} payment: ${paymentStatus}`,
    });
    return ok(updated);
  },

  async updateFulfillment(id: string, dto: UpdateFulfillmentDto): Promise<Result<Order>> {
    const repo = getOrderRepository();
    const order = await repo.findById(id);
    if (!order) return fail(AppErrors.notFound("Order not found"));
    const patch: Partial<Order> = {
      fulfillment: {
        ...order.fulfillment,
        courier: dto.courier || order.fulfillment.courier,
        trackingNumber: dto.trackingNumber || order.fulfillment.trackingNumber,
      },
      updatedAt: new Date().toISOString(),
      activity: [
        logEntry("fulfillment", `Tracking updated${dto.courier ? ` · ${dto.courier}` : ""}${dto.trackingNumber ? ` (${dto.trackingNumber})` : ""}`),
        ...order.activity,
      ].slice(0, 50),
    };
    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Order not found"));
    return ok(updated);
  },

  async addNote(id: string, note: string): Promise<Result<Order>> {
    const repo = getOrderRepository();
    const order = await repo.findById(id);
    if (!order) return fail(AppErrors.notFound("Order not found"));
    const patch: Partial<Order> = {
      activity: [logEntry("note", note.trim()), ...order.activity].slice(0, 50),
    };
    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Order not found"));
    return ok(updated);
  },

  /**
   * Edit order details (shipping address + internal notes). Blocked once the
   * order is delivered/cancelled/refunded.
   */
  async updateDetails(
    id: string,
    dto: { shippingAddress?: Order["shippingAddress"]; notes?: string }
  ): Promise<Result<Order>> {
    const repo = getOrderRepository();
    const order = await repo.findById(id);
    if (!order) return fail(AppErrors.notFound("Order not found"));
    if (["delivered", "cancelled", "refunded"].includes(order.status)) {
      return fail(AppErrors.validation("A delivered or closed order can't be edited"));
    }
    const patch: Partial<Order> = {
      ...(dto.shippingAddress && { shippingAddress: dto.shippingAddress }),
      ...(dto.notes !== undefined && { notes: dto.notes || undefined }),
      updatedAt: new Date().toISOString(),
      activity: [logEntry("note", "Order details updated"), ...order.activity].slice(0, 50),
    };
    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Order not found"));
    return ok(updated);
  },

  /**
   * Apply a stock delta per line across every item in the order.
   *  • direction -1 → sale committed: reduce stock + bump each product's
   *    lifetime `soldCount`.
   *  • direction +1 → reversal (cancel/refund): restock. `soldCount` is a
   *    cumulative lifetime metric and is intentionally NOT decremented.
   */
  async commitStock(order: Order, direction: -1 | 1): Promise<void> {
    const reason = direction < 0 ? `order ${order.orderNumber}` : `order ${order.orderNumber} reversed`;
    for (const item of order.items) {
      await productService.adjustStock(item.productId, direction * item.qty, {
        variantId: item.variantId,
        reason,
      });
      if (direction < 0 && item.qty > 0) {
        await productService.incrementCounter(item.productId, "sold", item.qty);
      }
    }
  },
};
