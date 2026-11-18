/** DELETE /api/v1/account/sessions/:id — sign one of my devices out. */
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { requireCustomer } from "@/modules/customer-auth";
import { sessionService } from "@/modules/customer-auth/session.service";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  const ok = await sessionService.revoke((await params).id, "signed_out_by_user", g.value.customerId);
  if (!ok) return jsonError(AppErrors.notFound("Device not found or already signed out"));
  return jsonOk({ ok: true });
}
