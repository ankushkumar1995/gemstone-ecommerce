import "server-only";

/**
 * Customer SELF-SERVICE account service.
 * ─────────────────────────────────────────────────────────────────────────
 * Everything here is SESSION-SCOPED: every method takes the authenticated
 * `customerId` (resolved by requireCustomer from the httpOnly cookie — never
 * from the request body), so a customer can only ever read/mutate their OWN
 * profile, addresses and wishlist. There is no way to target another account.
 *
 * Covers the storefront account dashboard:
 *   • profile    — update name / phone (email is intentionally immutable here;
 *                  changing a login identity needs a verify flow — later)
 *   • addresses  — list / add / update / remove / set-default (stable ids,
 *                  single-default invariant enforced)
 *   • wishlist   — list ids / add / remove (deduped, bounded)
 *
 * All writes go through the Mongoose model directly with atomic operators so
 * concurrent requests from the same account stay consistent.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import type { CustomerAddress } from "@/modules/customers/customer.types";

/** Max addresses / wishlist entries we keep per customer (guard rails). */
const MAX_ADDRESSES = 20;
const MAX_WISHLIST = 200;

/** Lazy model loader (server-only, mongoose). */
async function model() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  const { CustomerModel } = await import("@/modules/customers/customer.model");
  await connectMongoose();
  return CustomerModel;
}

/** Raw stored address shape (as persisted on the customer doc). */
interface StoredAddress {
  id?: string;
  name?: string;
  phone?: string;
  label?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
}

function toAddress(a: StoredAddress, i: number): CustomerAddress {
  return {
    id: a.id ?? `adr_${i}`,
    label: a.label ?? "",
    name: a.name || undefined,
    phone: a.phone || undefined,
    line1: a.line1 ?? "",
    line2: a.line2 || undefined,
    city: a.city ?? "",
    state: a.state || undefined,
    postalCode: a.postalCode || undefined,
    country: a.country || "India",
    isDefault: Boolean(a.isDefault),
  };
}

/** Normalise an address list → persisted shape, enforcing single default. */
function persistable(list: CustomerAddress[]): StoredAddress[] {
  let defaultSeen = false;
  return list.map((a) => {
    const isDefault = Boolean(a.isDefault) && !defaultSeen;
    if (isDefault) defaultSeen = true;
    return {
      id: a.id,
      name: a.name ?? "",
      phone: a.phone ?? "",
      label: a.label ?? "",
      line1: a.line1 ?? "",
      line2: a.line2 ?? "",
      city: a.city ?? "",
      state: a.state ?? "",
      postalCode: a.postalCode ?? "",
      country: a.country || "India",
      isDefault,
    };
  });
}

/** Input accepted when creating / editing an address (ids are server-owned). */
export interface AddressInput {
  label?: string;
  name?: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
}

export const customerAccountService = {
  /* ───────────────────────── profile ───────────────────────── */

  /**
   * Update the signed-in customer's editable profile fields. Email is NOT
   * editable here on purpose (it's the login identity). Logs an activity entry.
   */
  async updateProfile(
    customerId: string,
    input: { name?: string; phone?: string },
  ): Promise<Result<{ id: string; name: string; phone?: string }>> {
    const set: Record<string, unknown> = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length < 2) return fail(AppErrors.validation("Please enter your name"));
      set.name = name;
    }
    if (input.phone !== undefined) {
      set.phone = input.phone.trim() || null;
    }
    if (Object.keys(set).length === 0) {
      return fail(AppErrors.validation("Nothing to update"));
    }

    const M = await model();
    const doc = await M.findOneAndUpdate(
      { _id: customerId, isDeleted: { $ne: true } },
      {
        $set: set,
        $push: {
          activity: {
            $each: [{ id: newId("cact"), at: new Date().toISOString(), type: "updated", message: "Profile updated", actor: "Customer" }],
            $position: 0,
            $slice: 50,
          },
        },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!doc) return fail(AppErrors.unauthorized("Not signed in"));
    return ok({ id: String(doc._id), name: doc.name, phone: doc.phone ?? undefined });
  },

  /* ───────────────────────── addresses ───────────────────────── */

  /** List the signed-in customer's saved addresses. */
  async listAddresses(customerId: string): Promise<Result<CustomerAddress[]>> {
    const M = await model();
    const doc = await M.findOne({ _id: customerId, isDeleted: { $ne: true } })
      .select("addresses")
      .lean();
    if (!doc) return fail(AppErrors.unauthorized("Not signed in"));
    const list = ((doc.addresses as StoredAddress[]) ?? []).map(toAddress);
    return ok(list);
  },

  /**
   * Add a new address. First address (or an explicit isDefault) becomes the
   * default; the single-default invariant is enforced across the list.
   */
  async addAddress(customerId: string, input: AddressInput): Promise<Result<CustomerAddress[]>> {
    const M = await model();
    const doc = await M.findOne({ _id: customerId, isDeleted: { $ne: true } }).select("addresses");
    if (!doc) return fail(AppErrors.unauthorized("Not signed in"));

    const current = ((doc.addresses as StoredAddress[]) ?? []).map(toAddress);
    if (current.length >= MAX_ADDRESSES) {
      return fail(AppErrors.validation(`You can save up to ${MAX_ADDRESSES} addresses`));
    }

    const makeDefault = Boolean(input.isDefault) || current.length === 0;
    const fresh: CustomerAddress = {
      id: newId("adr"),
      label: input.label?.trim() || "Home",
      name: input.name?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      line1: input.line1.trim(),
      line2: input.line2?.trim() || undefined,
      city: input.city.trim(),
      state: input.state?.trim() || undefined,
      postalCode: input.postalCode?.trim() || undefined,
      country: input.country?.trim() || "India",
      isDefault: makeDefault,
    };

    const next = makeDefault ? current.map((a) => ({ ...a, isDefault: false })) : current;
    next.push(fresh);

    await M.updateOne({ _id: customerId }, { $set: { addresses: persistable(next) } });
    return ok(next.map((a, i) => toAddress(a as StoredAddress, i)));
  },

  /** Update one address by id. Enforces ownership (id must exist on this doc). */
  async updateAddress(
    customerId: string,
    addressId: string,
    input: AddressInput,
  ): Promise<Result<CustomerAddress[]>> {
    const M = await model();
    const doc = await M.findOne({ _id: customerId, isDeleted: { $ne: true } }).select("addresses");
    if (!doc) return fail(AppErrors.unauthorized("Not signed in"));

    const current = ((doc.addresses as StoredAddress[]) ?? []).map(toAddress);
    const idx = current.findIndex((a) => a.id === addressId);
    if (idx === -1) return fail(AppErrors.notFound("Address not found"));

    const makeDefault = Boolean(input.isDefault);
    const updated: CustomerAddress = {
      ...current[idx],
      label: input.label?.trim() || current[idx].label,
      name: input.name?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      line1: input.line1.trim(),
      line2: input.line2?.trim() || undefined,
      city: input.city.trim(),
      state: input.state?.trim() || undefined,
      postalCode: input.postalCode?.trim() || undefined,
      country: input.country?.trim() || "India",
      isDefault: makeDefault || current[idx].isDefault,
    };

    let next = current.map((a, i) => (i === idx ? updated : a));
    if (makeDefault) next = next.map((a, i) => ({ ...a, isDefault: i === idx }));

    await M.updateOne({ _id: customerId }, { $set: { addresses: persistable(next) } });
    return ok(next.map((a, i) => toAddress(a as StoredAddress, i)));
  },

  /** Remove an address by id. If the default is removed, promote the first left. */
  async removeAddress(customerId: string, addressId: string): Promise<Result<CustomerAddress[]>> {
    const M = await model();
    const doc = await M.findOne({ _id: customerId, isDeleted: { $ne: true } }).select("addresses");
    if (!doc) return fail(AppErrors.unauthorized("Not signed in"));

    const current = ((doc.addresses as StoredAddress[]) ?? []).map(toAddress);
    const target = current.find((a) => a.id === addressId);
    if (!target) return fail(AppErrors.notFound("Address not found"));

    let next = current.filter((a) => a.id !== addressId);
    // keep a default alive
    if (target.isDefault && next.length > 0 && !next.some((a) => a.isDefault)) {
      next = next.map((a, i) => ({ ...a, isDefault: i === 0 }));
    }

    await M.updateOne({ _id: customerId }, { $set: { addresses: persistable(next) } });
    return ok(next.map((a, i) => toAddress(a as StoredAddress, i)));
  },

  /** Mark one address as the default (clears the flag on all others). */
  async setDefaultAddress(customerId: string, addressId: string): Promise<Result<CustomerAddress[]>> {
    const M = await model();
    const doc = await M.findOne({ _id: customerId, isDeleted: { $ne: true } }).select("addresses");
    if (!doc) return fail(AppErrors.unauthorized("Not signed in"));

    const current = ((doc.addresses as StoredAddress[]) ?? []).map(toAddress);
    if (!current.some((a) => a.id === addressId)) {
      return fail(AppErrors.notFound("Address not found"));
    }
    const next = current.map((a) => ({ ...a, isDefault: a.id === addressId }));
    await M.updateOne({ _id: customerId }, { $set: { addresses: persistable(next) } });
    return ok(next.map((a, i) => toAddress(a as StoredAddress, i)));
  },

  /* ───────────────────────── wishlist ───────────────────────── */

  /** Product ids the customer has saved. */
  async listWishlist(customerId: string): Promise<Result<string[]>> {
    const M = await model();
    const doc = await M.findOne({ _id: customerId, isDeleted: { $ne: true } })
      .select("wishlist")
      .lean();
    if (!doc) return fail(AppErrors.unauthorized("Not signed in"));
    return ok(((doc as unknown as { wishlist?: string[] }).wishlist ?? []).slice());
  },

  /** Add a product id to the wishlist (atomic, deduped via $addToSet). */
  async addWishlist(customerId: string, productId: string): Promise<Result<string[]>> {
    const id = productId.trim();
    if (!id) return fail(AppErrors.validation("Product id is required"));
    const M = await model();
    // guard the size BEFORE adding (addToSet won't double-count, but cap total)
    const existing = await M.findOne({ _id: customerId, isDeleted: { $ne: true } })
      .select("wishlist")
      .lean();
    if (!existing) return fail(AppErrors.unauthorized("Not signed in"));
    const list = (existing as unknown as { wishlist?: string[] }).wishlist ?? [];
    if (!list.includes(id) && list.length >= MAX_WISHLIST) {
      return fail(AppErrors.validation(`Wishlist is full (${MAX_WISHLIST} items)`));
    }
    const doc = await M.findOneAndUpdate(
      { _id: customerId, isDeleted: { $ne: true } },
      { $addToSet: { wishlist: id } },
      { new: true },
    )
      .select("wishlist")
      .lean();
    if (!doc) return fail(AppErrors.unauthorized("Not signed in"));
    return ok(((doc as unknown as { wishlist?: string[] }).wishlist ?? []).slice());
  },

  /** Remove a product id from the wishlist (atomic via $pull). */
  async removeWishlist(customerId: string, productId: string): Promise<Result<string[]>> {
    const id = productId.trim();
    const M = await model();
    const doc = await M.findOneAndUpdate(
      { _id: customerId, isDeleted: { $ne: true } },
      { $pull: { wishlist: id } },
      { new: true },
    )
      .select("wishlist")
      .lean();
    if (!doc) return fail(AppErrors.unauthorized("Not signed in"));
    return ok(((doc as unknown as { wishlist?: string[] }).wishlist ?? []).slice());
  },
};
