/**
 * /api/v1/account/wishlist  (customer, guarded)
 *   GET    → product ids the signed-in customer has saved
 *   POST   → add a product id         (body: { productId })
 *   DELETE → remove a product id      (body: { productId })
 *
 * Session-scoped: a customer only ever reads/writes their own wishlist.
 */

import { jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { requireCustomer, customerAccountService, wishlistSchema } from "@/modules/customer-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const res = await customerAccountService.listWishlist(guard.value.customerId);
  if (!res.ok) return jsonError(res.error);
  return jsonOk({ wishlist: res.value });
}

export async function POST(request: Request) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);

  const body = await request.json().catch(() => null);
  const parsed = parse(wishlistSchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const res = await customerAccountService.addWishlist(guard.value.customerId, parsed.value.productId);
  if (!res.ok) return jsonError(res.error);
  return jsonOk({ wishlist: res.value }, 201);
}

export async function DELETE(request: Request) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);

  const body = await request.json().catch(() => null);
  const parsed = parse(wishlistSchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const res = await customerAccountService.removeWishlist(guard.value.customerId, parsed.value.productId);
  if (!res.ok) return jsonError(res.error);
  return jsonOk({ wishlist: res.value });
}
