/**
 * /api/v1/search?q=...  (admin global search)
 * Searches products, orders and customers; returns a small grouped result.
 */

import type { NextRequest } from "next/server";
import { handle, jsonOk } from "@/core/http";
import { productService } from "@/modules/products";
import { orderService } from "@/modules/orders";
import { customerService } from "@/modules/customers";

export const dynamic = "force-dynamic";

export interface SearchHit {
  type: "product" | "order" | "customer";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  image?: string;
}

export async function GET(request: NextRequest) {
  return handle(async () => {
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();
    if (q.length < 2) return jsonOk<SearchHit[]>([]);

    const [prodRes, orderRes, custRes] = await Promise.all([
      productService.list(),
      orderService.list(),
      customerService.list(),
    ]);

    const hits: SearchHit[] = [];

    if (prodRes.ok) {
      for (const p of prodRes.value) {
        if (
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        ) {
          hits.push({
            type: "product",
            id: p.id,
            title: p.name,
            subtitle: `Product · ${p.category}`,
            href: `/admin/products/${p.id}`,
            image: p.image,
          });
        }
      }
    }

    if (orderRes.ok) {
      for (const o of orderRes.value) {
        if (
          o.orderNumber.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.email.toLowerCase().includes(q)
        ) {
          hits.push({
            type: "order",
            id: o.id,
            title: o.orderNumber,
            subtitle: `Order · ${o.customer.name} · ${o.status}`,
            href: `/admin/orders/${o.id}`,
          });
        }
      }
    }

    if (custRes.ok) {
      for (const c of custRes.value) {
        if (c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) {
          hits.push({
            type: "customer",
            id: c.id,
            title: c.name,
            subtitle: `Customer · ${c.email}`,
            href: `/admin/customers/${c.id}`,
            image: c.avatar,
          });
        }
      }
    }

    return jsonOk(hits.slice(0, 20));
  });
}
