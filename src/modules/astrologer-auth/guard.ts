import "server-only";

/**
 * Server-side ASTROLOGER guard — the security boundary for /api/v1/astrologer/*.
 * Verifies the access cookie, device binding and token version, then loads the
 * account fresh so a suspension takes effect on the very next request.
 *
 *   const g = await requireAstrologer();               // any signed-in partner
 *   const g = await requireAstrologer({ approved: true }); // live features only
 */

import { cookies, headers } from "next/headers";
import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { clientIp } from "@/core/rate-limit";
import { verifyAstroToken, astroDeviceFingerprint, ASTRO_ACCESS_COOKIE } from "@/core/astrologer-jwt";
import { getAstrologerRepository } from "@/modules/astrologers/astrologer.repository";
import type { Astrologer } from "@/modules/astrologers/astrologer.types";

export async function requireAstrologer(opts: { approved?: boolean; allowPasswordChange?: boolean } = {}): Promise<Result<{ astrologer: Astrologer }>> {
  const [store, hdrs] = await Promise.all([cookies(), headers()]);
  const claims = await verifyAstroToken(store.get(ASTRO_ACCESS_COOKIE)?.value, "access");
  if (!claims) return fail(AppErrors.unauthorized("Please sign in to the partner panel"));
  const fp = await astroDeviceFingerprint(clientIp(hdrs), hdrs.get("user-agent") ?? "");
  if (claims.fp && claims.fp !== fp) return fail(AppErrors.unauthorized("Session not valid on this device"));

  const repo = getAstrologerRepository();
  const [a, auth] = await Promise.all([repo.findById(claims.sub), repo.getAuth(claims.sub)]);
  if (!a || !auth || auth.tokenVersion !== claims.ver) return fail(AppErrors.unauthorized("Session expired. Please sign in again."));
  if (a.status === "suspended") return fail(AppErrors.forbidden("Your account is suspended. Contact support."));
  if (a.mustChangePassword && !opts.allowPasswordChange) return fail(AppErrors.forbidden("Set a new password to continue"));
  if (opts.approved && a.status !== "approved") return fail(AppErrors.forbidden("This needs an approved partner profile"));
  return ok({ astrologer: a });
}
