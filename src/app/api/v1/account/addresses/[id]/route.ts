/**
 * /api/v1/account/addresses/[id]  (customer, guarded)
 *   PATCH  → update an address, or set it as default.
 *            • full body (passes addressSchema)            → edit the address
 *            • body { action: "setDefault" }                → just set default
 *   DELETE → remove the address (default is re-assigned if needed)
 *
 * Ownership is enforced: the id must exist on the SIGNED-IN customer's doc,
 * so no customer can touch another customer's address.
 */

import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { requireCustomer, customerAccountService, addressSchema } from "@/modules/customer-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  // Lightweight "set default" action — no full address payload required.
  if (body && body.action === "setDefault") {
    const res = await customerAccountService.setDefaultAddress(guard.value.customerId, id);
    if (!res.ok) return jsonError(res.error);
    return jsonOk({ addresses: res.value });
  }

  const parsed = parse(addressSchema, body);
  if (!parsed.ok) return jsonError(parsed.error);
  const res = await customerAccountService.updateAddress(guard.value.customerId, id, parsed.value);
  if (!res.ok) return jsonError(res.error);
  return jsonOk({ addresses: res.value });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const { id } = await params;

  const res = await customerAccountService.removeAddress(guard.value.customerId, id);
  if (!res.ok) return jsonError(res.error);
  return jsonOk({ addresses: res.value });
}
