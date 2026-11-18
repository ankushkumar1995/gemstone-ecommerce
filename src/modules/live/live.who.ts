import "server-only";

/**
 * Who is calling a live endpoint. Unlike chat, a guest may watch (read only):
 * the result is empty instead of an error when nobody is signed in.
 */
import { requireCustomer } from "@/modules/customer-auth";
import { requireAstrologer } from "@/modules/astrologer-auth";
import type { LiveWho } from "./live.service";

export async function liveWho(): Promise<LiveWho> {
  const [c, a] = await Promise.all([requireCustomer().catch(() => null), requireAstrologer({ approved: true }).catch(() => null)]);
  return { customerId: c?.ok ? c.value.customerId : undefined, astrologerId: a?.ok ? a.value.astrologer.id : undefined };
}
