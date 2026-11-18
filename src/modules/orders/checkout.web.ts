/**
 * The website checkout still posts the older order DTO. Map it to the
 * hardened checkout input: keep only items, coupon, address and notes; drop
 * every client-side price, discount, shipping, tax and status.
 */
import { newId } from "@/core/id";
import type { CreateOrderDto } from "./order.schema";
import type { PlaceInput } from "./order-checkout.service";

const ten = (v?: string) => {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
};

export function websitePlaceInput(dto: CreateOrderDto, method: "cod" | "online", requestId?: unknown): PlaceInput {
  const a = dto.shippingAddress;
  return {
    items: dto.items.map((i) => ({ productId: i.productId, variantId: i.variantId || undefined, qty: i.qty, config: i.config })),
    couponCode: dto.couponCode || undefined,
    shippingAddress: {
      name: a.name,
      phone: ten(a.phone) || undefined,
      line1: a.line1,
      line2: a.line2 || undefined,
      city: a.city,
      state: a.state || undefined,
      postalCode: a.postalCode || undefined,
      country: a.country || "India",
    },
    method,
    // The website does not send one yet: each click is its own request.
    requestId: typeof requestId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(requestId) ? requestId : newId("web").replace(/[^A-Za-z0-9_-]/g, ""),
    contact: dto.customer ? { name: dto.customer.name, email: dto.customer.email, phone: dto.customer.phone || undefined } : undefined,
    notes: dto.notes || undefined,
  };
}
