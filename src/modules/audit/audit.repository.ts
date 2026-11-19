/**
 * Audit domain — repository.
 *
 *  • mongo — `audit_log` collection, append-only (entries are never updated
 *    or deleted by the app). Used whenever MONGODB_URI is set (see dataSourceFor).
 *  • mock  — in-memory ring buffer for running without a database (lost on restart).
 *
 * Queries are newest first with an `at` cursor, so the Activity page can page back.
 */

import { Schema, deleteModel, model, models, type Model } from "mongoose";
import { dataSourceFor } from "@/core/config/env";
import type { AuditAction, AuditEntity, AuditEntry } from "./audit.types";

const MAX_MOCK = 500;

export interface AuditQuery { entity?: AuditEntity; action?: AuditAction; q?: string; entityId?: string; before?: string; limit?: number }

export interface AuditRepository {
  add(entry: AuditEntry): Promise<void>;
  query(f: AuditQuery): Promise<AuditEntry[]>;
}

const clampLimit = (n?: number) => Math.min(Math.max(Math.floor(n ?? 200), 1), 500);

/* ------------------------------------------------------------------ *
 * Mock
 * ------------------------------------------------------------------ */
const store: AuditEntry[] = [];

const mockAuditRepository: AuditRepository = {
  async add(entry) {
    store.unshift(entry);
    if (store.length > MAX_MOCK) store.length = MAX_MOCK;
  },
  async query(f) {
    const q = f.q?.toLowerCase();
    return store
      .filter((e) => (!f.entity || e.entity === f.entity) && (!f.action || e.action === f.action) && (!f.entityId || e.entityId === f.entityId) && (!f.before || e.at < f.before))
      .filter((e) => !q || e.summary.toLowerCase().includes(q) || (e.entityLabel ?? "").toLowerCase().includes(q) || e.actor.toLowerCase().includes(q))
      .slice(0, clampLimit(f.limit))
      .map((e) => ({ ...e }));
  },
};

/* ------------------------------------------------------------------ *
 * Mongo
 * ------------------------------------------------------------------ */
type AnyDoc = Record<string, unknown>;

const AuditSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    at: { type: String, required: true },
    actor: { type: String, required: true },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String },
    entityLabel: { type: String },
    summary: { type: String, required: true },
  },
  { collection: "audit_log", versionKey: false },
);
AuditSchema.index({ at: -1 });
AuditSchema.index({ entity: 1, at: -1 });
AuditSchema.index({ action: 1, at: -1 });
AuditSchema.index({ entityId: 1, at: -1 });

if (process.env.NODE_ENV !== "production" && models.AuditEntry) deleteModel("AuditEntry");
const AuditModel: Model<AnyDoc> = (models.AuditEntry as Model<AnyDoc>) ?? model<AnyDoc>("AuditEntry", AuditSchema);

async function db() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return AuditModel;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toEntry = (d: AnyDoc): AuditEntry => ({
  id: d.id as string, at: d.at as string, actor: d.actor as string, action: d.action as AuditAction, entity: d.entity as AuditEntity,
  ...(d.entityId ? { entityId: d.entityId as string } : {}), ...(d.entityLabel ? { entityLabel: d.entityLabel as string } : {}), summary: d.summary as string,
});

const mongoAuditRepository: AuditRepository = {
  async add(entry) {
    const M = await db();
    // Long free text is cut so one bad caller cannot bloat the log.
    await M.create({ ...entry, summary: entry.summary.slice(0, 1000), entityLabel: entry.entityLabel?.slice(0, 200), actor: entry.actor.slice(0, 200) });
  },
  async query(f) {
    const M = await db();
    const filter: Record<string, unknown> = {};
    if (f.entity) filter.entity = f.entity;
    if (f.action) filter.action = f.action;
    if (f.entityId) filter.entityId = f.entityId;
    if (f.before) filter.at = { $lt: f.before };
    const q = f.q?.trim().slice(0, 100);
    if (q) {
      const re = new RegExp(escapeRe(q), "i");
      filter.$or = [{ summary: re }, { entityLabel: re }, { actor: re }];
    }
    const rows = await M.find(filter).sort({ at: -1 }).limit(clampLimit(f.limit)).select("-_id").lean<AnyDoc[]>();
    return rows.map(toEntry);
  },
};

export function getAuditRepository(): AuditRepository {
  return dataSourceFor("audit") === "mongo" ? mongoAuditRepository : mockAuditRepository;
}
