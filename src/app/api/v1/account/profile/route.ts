/**
 * /api/v1/account/profile  (customer, guarded)
 *   PATCH → update the signed-in customer's name / phone.
 *
 * Email is NOT editable here — it's the login identity and changing it needs a
 * verification flow. The customerId comes from the session, never the body.
 */

import { jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { requireCustomer, customerAccountService, updateProfileSchema } from "@/modules/customer-auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);

  const body = await request.json().catch(() => null);
  const parsed = parse(updateProfileSchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const res = await customerAccountService.updateProfile(guard.value.customerId, {
    name: parsed.value.name,
    phone: parsed.value.phone === "" ? "" : parsed.value.phone,
  });
  if (!res.ok) return jsonError(res.error);
  return jsonOk({ profile: res.value });
}
