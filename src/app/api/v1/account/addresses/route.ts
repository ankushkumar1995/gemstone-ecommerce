/**
 * /api/v1/account/addresses  (customer, guarded)
 *   GET  → list the signed-in customer's saved addresses
 *   POST → add a new address (first one / explicit flag becomes default)
 */

import { jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { requireCustomer, customerAccountService, addressSchema } from "@/modules/customer-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const res = await customerAccountService.listAddresses(guard.value.customerId);
  if (!res.ok) return jsonError(res.error);
  return jsonOk({ addresses: res.value });
}

export async function POST(request: Request) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);

  const body = await request.json().catch(() => null);
  const parsed = parse(addressSchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const res = await customerAccountService.addAddress(guard.value.customerId, parsed.value);
  if (!res.ok) return jsonError(res.error);
  return jsonOk({ addresses: res.value }, 201);
}
