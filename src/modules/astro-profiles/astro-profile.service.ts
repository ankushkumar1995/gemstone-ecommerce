import "server-only";

/**
 * Primary astro profile (the account holder's birth details).
 * Session-scoped: callers pass the authenticated customerId, never a body id.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import type { AstroProfileDto } from "./astro-profile.schema";

export interface AstroProfilePublic extends AstroProfileDto {
  updatedAt: string;
}

async function models() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  const [{ AstroProfileModel }, { CustomerModel }] = await Promise.all([
    import("./astro-profile.model"),
    import("@/modules/customers/customer.model"),
  ]);
  await connectMongoose();
  return { AstroProfileModel, CustomerModel };
}

type Doc = AstroProfileDto & { updatedAt?: Date };

function toPublic(d: Doc): AstroProfilePublic {
  return {
    fullName: d.fullName,
    dob: d.dob,
    birthTime: d.birthTime,
    timeAccuracy: d.timeAccuracy,
    gender: d.gender,
    birthPlace: d.birthPlace,
    language: d.language ?? "English",
    interests: d.interests ?? [],
    updatedAt: (d.updatedAt ?? new Date()).toISOString(),
  };
}

const isDup = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: number }).code === 11000;

export const astroProfileService = {
  /**
   * For sign-in / me responses: the profile, null when the customer has none,
   * or undefined when the lookup failed (client must then ask again; a failed
   * lookup must never look like "no profile" and push the user into setup).
   */
  async forResponse(customerId: string): Promise<AstroProfilePublic | null | undefined> {
    try {
      const r = await astroProfileService.getPrimary(customerId);
      return r.ok ? r.value : undefined;
    } catch {
      return undefined;
    }
  },

  async getPrimary(customerId: string): Promise<Result<AstroProfilePublic | null>> {
    const { AstroProfileModel } = await models();
    const doc = await AstroProfileModel.findOne({ customerId, isPrimary: true }).lean<Doc>();
    return ok(doc ? toPublic(doc) : null);
  },

  /** Create or replace the primary profile. Idempotent, safe to retry. */
  async savePrimary(customerId: string, dto: AstroProfileDto, source: "web" | "android" | "ios"): Promise<Result<AstroProfilePublic>> {
    const { AstroProfileModel, CustomerModel } = await models();
    const alive = await CustomerModel.exists({ _id: customerId, isDeleted: { $ne: true } });
    if (!alive) return fail(AppErrors.unauthorized("Session expired. Please sign in again."));

    const write = () =>
      AstroProfileModel.findOneAndUpdate(
        { customerId, isPrimary: true },
        { $set: { ...dto, source }, $setOnInsert: { customerId, isPrimary: true } },
        { upsert: true, returnDocument: "after", runValidators: true },
      ).lean<Doc>();

    let doc: Doc | null;
    try {
      doc = await write();
    } catch (e) {
      // Two devices saving the first profile at the same moment: one insert wins,
      // the other hits the unique index. Retrying turns it into an update.
      if (!isDup(e)) throw e;
      doc = await write();
    }
    if (!doc) return fail(AppErrors.internal("Could not save your profile. Please try again."));

    // Phone sign-ups have no account name yet: use the one from the profile.
    await CustomerModel.updateOne(
      { _id: customerId, $or: [{ name: { $exists: false } }, { name: null }, { name: "" }] },
      { $set: { name: dto.fullName } },
    );
    return ok(toPublic(doc));
  },
};
