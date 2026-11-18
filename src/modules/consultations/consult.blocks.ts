import "server-only";

/**
 * Astrologer's block list. One row per (astrologer, customer) in consult_blocks.
 * A blocked customer cannot request a chat, join the waitlist, or comment, ask
 * or send gifts on any of that astrologer's lives. They are not told why
 * (chat and waitlist say "not taking chats"; live says "you cannot comment").
 * Only the first name is shown to the astrologer; the customer id never leaves the server.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { cache } from "@/core/cache";
import { auditService } from "@/modules/audit";

type Doc = Record<string, unknown> & { _id: unknown };

async function M() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return import("./consult.model");
}

export interface BlockRow { id: string; name: string; via: string; reason: string; at: string }

export const blockService = {
  async list(astrologerId: string, cursor?: string | null): Promise<{ total: number; items: BlockRow[]; nextCursor: string | null }> {
    const { ConsultBlockModel } = await M();
    const total = await ConsultBlockModel.countDocuments({ astrologerId });
    const rows = await ConsultBlockModel.find({ astrologerId, ...(cursor ? { at: { $lt: cursor } } : {}) }).sort({ at: -1 }).limit(51).lean<Doc[]>();
    const items = rows.slice(0, 50).map((r) => ({
      id: String(r._id), name: ((r.name as string) || "Customer").split(" ")[0].slice(0, 40), via: (r.via as string) || "chat",
      reason: (r.reason as string) ?? "", at: (r.at as string) ?? "",
    }));
    return { total, items, nextCursor: rows.length > 50 ? items[items.length - 1].at : null };
  },

  async unblock(astrologerId: string, id: string): Promise<Result<{ ok: true }>> {
    if (!/^[a-f0-9]{24}$/i.test(id)) return fail(AppErrors.notFound("Not found"));
    const { ConsultBlockModel } = await M();
    const d = await ConsultBlockModel.findOneAndDelete({ _id: id, astrologerId }).lean<Doc>();
    if (!d) return fail(AppErrors.notFound("Not found"));
    cache.del(`live:pc:${astrologerId}`);
    await auditService.record({ action: "update", entity: "astrologer", entityId: astrologerId, entityLabel: astrologerId, summary: `Astrologer unblocked ${(d.name as string) || "a customer"}`, actor: "Astrologer" }).catch(() => undefined);
    return ok({ ok: true });
  },
};
