import "server-only";

/**
 * Who is calling a shared chat endpoint: the customer (app bearer token or
 * website cookie) and/or the astrologer (partner panel cookie). The session
 * itself decides which role applies (its customerId / astrologerId).
 */
import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { requireCustomer } from "@/modules/customer-auth";
import { requireAstrologer } from "@/modules/astrologer-auth";

export async function consultWho(): Promise<Result<{ customerId?: string; astrologerId?: string }>> {
  const [c, a] = await Promise.all([requireCustomer().catch(() => null), requireAstrologer({ approved: true }).catch(() => null)]);
  const who = { customerId: c?.ok ? c.value.customerId : undefined, astrologerId: a?.ok ? a.value.astrologer.id : undefined };
  if (!who.customerId && !who.astrologerId) return fail((c && !c.ok ? c.error : null) ?? AppErrors.unauthorized("Please sign in to continue"));
  return ok(who);
}
