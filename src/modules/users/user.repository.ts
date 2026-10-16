/**
 * Users domain — repository.
 *
 * Mongo (Mongoose) is the production path; a mock keeps the app runnable with
 * DATA_SOURCE_USERS != mongo. Queries are optimised: `.lean()`, `.select()` to
 * exclude secrets, soft-delete filter, and count+page run in parallel.
 */

import { dataSourceFor } from "@/core/config/env";
import type { AdminUser } from "./user.types";
import type { UserDoc } from "./user.model";

/* ------------------------------------------------------------------ *
 * Shared types
 * ------------------------------------------------------------------ */
export interface UserSearch {
  skip: number;
  limit: number;
  sort: Record<string, 1 | -1>;
  q?: string;
  status?: string;
  roleId?: string;
}

/** Fields the service may set on create (DB assigns id/timestamps). */
export interface CreateUserInput {
  name: string;
  email: string;
  phone?: string;
  roleId: string;
  status?: AdminUser["status"];
  avatarColor?: string;
  avatarUrl?: string;
  invitedBy?: string;
  createdBy?: string;
  /** Pre-hashed password (the service hashes before calling). */
  passwordHash?: string;
  mustChangePassword?: boolean;
}

/** A user WITH its password hash — only used by the auth/login path. */
export interface UserWithSecret extends AdminUser {
  passwordHash?: string;
  mustChangePassword?: boolean;
  failedLoginCount?: number;
  lockedUntil?: string;
}

export interface UserRepository {
  findAll(): Promise<AdminUser[]>;
  search(params: UserSearch): Promise<{ items: AdminUser[]; total: number }>;
  findById(id: string): Promise<AdminUser | null>;
  findByEmail(email: string): Promise<AdminUser | null>;
  /** Login path: fetch the user including the (normally hidden) password hash. */
  findForAuth(email: string): Promise<UserWithSecret | null>;
  /** Email taken by a different, non-deleted user? */
  emailTakenBy(email: string, exceptId?: string): Promise<boolean>;
  countActiveByRoleId(roleId: string): Promise<number>;
  create(input: CreateUserInput): Promise<AdminUser>;
  update(id: string, patch: Partial<AdminUser>): Promise<AdminUser | null>;
  /** Set a new password hash (+ clear/force the must-change flag). */
  setPassword(id: string, passwordHash: string, mustChangePassword: boolean): Promise<boolean>;
  /** Record a failed login attempt; optionally lock the account until a time. */
  recordFailedLogin(id: string, failedCount: number, lockUntil: Date | null): Promise<void>;
  /** Record a successful login (reset counters, stamp last login). */
  recordSuccessfulLogin(id: string, ip: string | null): Promise<void>;
  /** Clear a lockout (admin unlock): reset failed count + lockedUntil. */
  unlock(id: string): Promise<boolean>;
  /** Current token version (for validating/invalidating sessions). */
  getTokenVersion(id: string): Promise<number | null>;
  /** Bump token version → kills every issued access + refresh token. */
  bumpTokenVersion(id: string): Promise<number>;
  /** Store the current refresh-token hash + bound fingerprint (rotation). */
  setRefreshToken(id: string, hash: string | null, fingerprint: string | null): Promise<void>;
  /** Fetch refresh auth material (hash, fingerprint, version) for a user. */
  getRefreshAuth(id: string): Promise<{ hash: string | null; fingerprint: string | null; tokenVersion: number } | null>;
  remove(id: string, deletedBy?: string): Promise<boolean>; // soft delete
  restore(id: string): Promise<AdminUser | null>;
}

/* ------------------------------------------------------------------ *
 * Mongo (Mongoose)
 * ------------------------------------------------------------------ */
// Public-safe projection — never fetch secrets for normal reads.
const PUBLIC_FIELDS =
  "name email phone avatarUrl avatarColor roleId status lastLoginAt lastSeenAt loginCount suspendedReason suspendedAt lockedUntil invitedBy acceptedAt isDeleted deletedAt createdAt updatedAt";

function fromDoc(doc: Partial<UserDoc> & { _id: unknown }): AdminUser {
  return {
    id: String(doc._id),
    name: doc.name as string,
    email: doc.email as string,
    phone: (doc.phone as string) || undefined,
    avatarUrl: (doc.avatarUrl as string) || undefined,
    avatarColor: (doc.avatarColor as string) || undefined,
    roleId: String(doc.roleId),
    status: doc.status as AdminUser["status"],
    lastLoginAt: toISO(doc.lastLoginAt),
    lastSeenAt: toISO(doc.lastSeenAt),
    loginCount: (doc.loginCount as number) ?? 0,
    suspendedReason: (doc.suspendedReason as string) || undefined,
    suspendedAt: toISO(doc.suspendedAt),
    lockedUntil: toISO(doc.lockedUntil),
    isLocked: doc.lockedUntil instanceof Date ? doc.lockedUntil > new Date() : false,
    invitedBy: doc.invitedBy ? String(doc.invitedBy) : undefined,
    acceptedAt: toISO(doc.acceptedAt),
    isDeleted: Boolean(doc.isDeleted),
    deletedAt: toISO(doc.deletedAt),
    createdAt: toISO(doc.createdAt) ?? new Date().toISOString(),
    updatedAt: toISO(doc.updatedAt) ?? new Date().toISOString(),
  };
}

function toISO(v: unknown): string | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return undefined;
}

function isObjectId(id: string): boolean {
  return /^[a-f0-9]{24}$/i.test(id);
}

const notDeleted = { isDeleted: { $ne: true } };

async function model() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  const { UserModel } = await import("./user.model");
  await connectMongoose();
  return UserModel;
}

const mongoUserRepository: UserRepository = {
  async findAll() {
    const M = await model();
    const docs = await M.find(notDeleted).select(PUBLIC_FIELDS).sort({ createdAt: -1 }).lean();
    return docs.map((d) => fromDoc(d as never));
  },

  async search({ skip, limit, sort, q, status, roleId }) {
    const M = await model();
    const filter: Record<string, unknown> = { ...notDeleted };
    if (status) filter.status = status;
    if (roleId && isObjectId(roleId)) filter.roleId = roleId;
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { email: rx }];
    }
    const sortSpec = Object.keys(sort).length ? sort : { createdAt: -1 as const };
    const [docs, total] = await Promise.all([
      M.find(filter).select(PUBLIC_FIELDS).sort(sortSpec).skip(skip).limit(limit).lean(),
      M.countDocuments(filter),
    ]);
    return { items: docs.map((d) => fromDoc(d as never)), total };
  },

  async findById(id) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOne({ _id: id, ...notDeleted }).select(PUBLIC_FIELDS).lean();
    return doc ? fromDoc(doc as never) : null;
  },

  async findByEmail(email) {
    const M = await model();
    const doc = await M.findOne({ email: email.toLowerCase(), ...notDeleted }).select(PUBLIC_FIELDS).lean();
    return doc ? fromDoc(doc as never) : null;
  },

  async findForAuth(email) {
    const M = await model();
    // Explicitly pull the secret fields (select:false by default).
    const doc = await M.findOne({ email: email.toLowerCase(), ...notDeleted })
      .select(`${PUBLIC_FIELDS} +passwordHash mustChangePassword failedLoginCount lockedUntil`)
      .lean();
    if (!doc) return null;
    const base = fromDoc(doc as never);
    const d = doc as Record<string, unknown>;
    return {
      ...base,
      passwordHash: (d.passwordHash as string) || undefined,
      mustChangePassword: Boolean(d.mustChangePassword),
      failedLoginCount: (d.failedLoginCount as number) ?? 0,
      lockedUntil: toISO(d.lockedUntil),
    };
  },

  async emailTakenBy(email, exceptId) {
    const M = await model();
    const q: Record<string, unknown> = { email: email.toLowerCase(), ...notDeleted };
    if (exceptId && isObjectId(exceptId)) q._id = { $ne: exceptId };
    return (await M.countDocuments(q)) > 0;
  },

  async countActiveByRoleId(roleId) {
    const M = await model();
    if (!isObjectId(roleId)) return 0;
    return M.countDocuments({ roleId, status: "active", ...notDeleted });
  },

  async create(input) {
    const M = await model();
    const created = await M.create({
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone ?? "",
      roleId: input.roleId,
      status: input.status ?? "invited",
      avatarColor: input.avatarColor ?? "",
      avatarUrl: input.avatarUrl ?? "",
      invitedBy: input.invitedBy && isObjectId(input.invitedBy) ? input.invitedBy : null,
      createdBy: input.createdBy && isObjectId(input.createdBy) ? input.createdBy : null,
      passwordHash: input.passwordHash ?? null,
      mustChangePassword: input.mustChangePassword ?? false,
      passwordChangedAt: input.passwordHash ? new Date() : null,
    });
    return fromDoc(created.toObject() as never);
  },

  async setPassword(id, passwordHash, mustChangePassword) {
    const M = await model();
    if (!isObjectId(id)) return false;
    const res = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: { passwordHash, mustChangePassword, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null } },
    ).lean();
    return Boolean(res);
  },

  async recordFailedLogin(id, failedCount, lockUntil) {
    const M = await model();
    if (!isObjectId(id)) return;
    await M.updateOne({ _id: id }, { $set: { failedLoginCount: failedCount, lockedUntil: lockUntil } });
  },

  async recordSuccessfulLogin(id, ip) {
    const M = await model();
    if (!isObjectId(id)) return;
    await M.updateOne(
      { _id: id },
      {
        $set: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(), lastLoginIp: ip },
        $inc: { loginCount: 1 },
      },
    );
  },

  async unlock(id) {
    const M = await model();
    if (!isObjectId(id)) return false;
    const res = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: { failedLoginCount: 0, lockedUntil: null } },
    ).lean();
    return Boolean(res);
  },

  async update(id, patch) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const { id: _ignore, createdAt: _c, updatedAt: _u, ...safe } = patch as Partial<AdminUser> & {
      id?: string;
    };
    void _ignore;
    void _c;
    void _u;
    const doc = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: safe },
      { new: true, runValidators: true },
    )
      .select(PUBLIC_FIELDS)
      .lean();
    return doc ? fromDoc(doc as never) : null;
  },

  async remove(id, deletedBy) {
    const M = await model();
    if (!isObjectId(id)) return false;
    const res = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          status: "disabled",
          deletedBy: deletedBy && isObjectId(deletedBy) ? deletedBy : null,
        },
      },
    ).lean();
    return Boolean(res);
  },

  async restore(id) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOneAndUpdate(
      { _id: id, isDeleted: true },
      { $set: { isDeleted: false, deletedAt: null, deletedBy: null, status: "active" } },
      { new: true },
    )
      .select(PUBLIC_FIELDS)
      .lean();
    return doc ? fromDoc(doc as never) : null;
  },

  async getTokenVersion(id) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findById(id).select("tokenVersion").lean();
    return doc ? ((doc as Record<string, unknown>).tokenVersion as number) ?? 0 : null;
  },

  async bumpTokenVersion(id) {
    const M = await model();
    if (!isObjectId(id)) return 0;
    const doc = await M.findByIdAndUpdate(
      id,
      { $inc: { tokenVersion: 1 }, $set: { refreshTokenHash: null, refreshFingerprint: null } },
      { new: true },
    )
      .select("tokenVersion")
      .lean();
    return doc ? ((doc as Record<string, unknown>).tokenVersion as number) ?? 0 : 0;
  },

  async setRefreshToken(id, hash, fingerprint) {
    const M = await model();
    if (!isObjectId(id)) return;
    await M.updateOne({ _id: id }, { $set: { refreshTokenHash: hash, refreshFingerprint: fingerprint } });
  },

  async getRefreshAuth(id) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findById(id).select("+refreshTokenHash +refreshFingerprint tokenVersion").lean();
    if (!doc) return null;
    const d = doc as Record<string, unknown>;
    return {
      hash: (d.refreshTokenHash as string) ?? null,
      fingerprint: (d.refreshFingerprint as string) ?? null,
      tokenVersion: (d.tokenVersion as number) ?? 0,
    };
  },
};

/* ------------------------------------------------------------------ *
 * Mock (in-memory) — kept minimal but behaviour-compatible.
 * ------------------------------------------------------------------ */
const mockStore: AdminUser[] = [];
const mockSecrets = new Map<string, { hash: string; mustChange: boolean }>();

const mockUserRepository: UserRepository = {
  async findAll() {
    return mockStore.filter((u) => !u.isDeleted).map((u) => ({ ...u }));
  },
  async search({ skip, limit, q, status, roleId }) {
    let list = mockStore.filter((u) => !u.isDeleted);
    if (status) list = list.filter((u) => u.status === status);
    if (roleId) list = list.filter((u) => u.roleId === roleId);
    if (q) {
      const n = q.toLowerCase();
      list = list.filter((u) => u.name.toLowerCase().includes(n) || u.email.toLowerCase().includes(n));
    }
    const total = list.length;
    return { items: list.slice(skip, skip + limit).map((u) => ({ ...u })), total };
  },
  async findById(id) {
    const u = mockStore.find((x) => x.id === id && !x.isDeleted);
    return u ? { ...u } : null;
  },
  async findByEmail(email) {
    const u = mockStore.find((x) => x.email.toLowerCase() === email.toLowerCase() && !x.isDeleted);
    return u ? { ...u } : null;
  },
  async findForAuth(email) {
    const u = mockStore.find((x) => x.email.toLowerCase() === email.toLowerCase() && !x.isDeleted);
    if (!u) return null;
    const secret = mockSecrets.get(u.id);
    return { ...u, passwordHash: secret?.hash, mustChangePassword: secret?.mustChange, failedLoginCount: 0 };
  },
  async emailTakenBy(email, exceptId) {
    return mockStore.some((u) => !u.isDeleted && u.email.toLowerCase() === email.toLowerCase() && u.id !== exceptId);
  },
  async countActiveByRoleId(roleId) {
    return mockStore.filter((u) => !u.isDeleted && u.roleId === roleId && u.status === "active").length;
  },
  async create(input) {
    const u: AdminUser = {
      id: `usr_${Date.now().toString(36)}`,
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      roleId: input.roleId,
      status: input.status ?? "invited",
      avatarColor: input.avatarColor,
      avatarUrl: input.avatarUrl,
      invitedBy: input.invitedBy,
      isDeleted: false,
      loginCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockStore.unshift(u);
    if (input.passwordHash) {
      mockSecrets.set(u.id, { hash: input.passwordHash, mustChange: input.mustChangePassword ?? false });
    }
    return { ...u };
  },
  async setPassword(id, passwordHash, mustChangePassword) {
    const u = mockStore.find((x) => x.id === id && !x.isDeleted);
    if (!u) return false;
    mockSecrets.set(id, { hash: passwordHash, mustChange: mustChangePassword });
    return true;
  },
  async recordFailedLogin() {
    /* mock: no persistence */
  },
  async recordSuccessfulLogin(id) {
    const u = mockStore.find((x) => x.id === id);
    if (u) {
      u.lastLoginAt = new Date().toISOString();
      u.loginCount = (u.loginCount ?? 0) + 1;
    }
  },
  async unlock(id) {
    const u = mockStore.find((x) => x.id === id && !x.isDeleted);
    if (!u) return false;
    u.lockedUntil = undefined;
    u.isLocked = false;
    return true;
  },
  async update(id, patch) {
    const idx = mockStore.findIndex((x) => x.id === id && !x.isDeleted);
    if (idx === -1) return null;
    mockStore[idx] = { ...mockStore[idx], ...patch, updatedAt: new Date().toISOString() };
    return { ...mockStore[idx] };
  },
  async remove(id) {
    const u = mockStore.find((x) => x.id === id && !x.isDeleted);
    if (!u) return false;
    u.isDeleted = true;
    u.deletedAt = new Date().toISOString();
    u.status = "disabled";
    return true;
  },
  async restore(id) {
    const u = mockStore.find((x) => x.id === id && x.isDeleted);
    if (!u) return null;
    u.isDeleted = false;
    u.deletedAt = undefined;
    u.status = "active";
    return { ...u };
  },
  async getTokenVersion() {
    return 0;
  },
  async bumpTokenVersion() {
    return 1;
  },
  async setRefreshToken() {
    /* mock: no persistence */
  },
  async getRefreshAuth() {
    return { hash: null, fingerprint: null, tokenVersion: 0 };
  },
};

export function getUserRepository(): UserRepository {
  switch (dataSourceFor("users")) {
    case "mongo":
      return mongoUserRepository;
    case "mock":
    default:
      return mockUserRepository;
  }
}
