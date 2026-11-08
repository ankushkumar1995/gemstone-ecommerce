/**
 * Service categories — repository (mock or mongo, same flag as services:
 * DATA_SOURCE_SERVICES). Unique name/slug are enforced by the database in
 * mongo, so two admins adding the same name at once get one category.
 */

import { dataSourceFor } from "@/core/config/env";
import { newId } from "@/core/id";
import type { ServiceCategory } from "./service-category.types";

export interface ServiceCategoryRepository {
  list(): Promise<ServiceCategory[]>;
  get(id: string): Promise<ServiceCategory | null>;
  clash(name: string, slug: string, exceptId?: string): Promise<"name" | "slug" | null>;
  create(c: Omit<ServiceCategory, "id">): Promise<ServiceCategory | "duplicate">;
  update(id: string, patch: Partial<ServiceCategory>): Promise<ServiceCategory | null | "duplicate">;
  remove(id: string): Promise<boolean>;
  setOrder(ids: string[]): Promise<void>;
}

const byOrder = (a: ServiceCategory, b: ServiceCategory) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
const lower = (s: string) => s.trim().toLowerCase();

/* ---- mock ---- */
declare global { var __serviceCatMem: ServiceCategory[] | undefined }
const mem: ServiceCategory[] = global.__serviceCatMem ?? [];
global.__serviceCatMem = mem;

// Synchronous check, so check-and-insert can't interleave with another request.
const memClash = (name: string, slug: string, exceptId?: string): "name" | "slug" | null => {
  if (mem.some((c) => c.id !== exceptId && lower(c.name) === lower(name))) return "name";
  if (mem.some((c) => c.id !== exceptId && c.slug === slug)) return "slug";
  return null;
};

const mockRepo: ServiceCategoryRepository = {
  async list() { return [...mem].sort(byOrder).map((c) => ({ ...c })); },
  async get(id) { const c = mem.find((x) => x.id === id); return c ? { ...c } : null; },
  async clash(name, slug, exceptId) { return memClash(name, slug, exceptId); },
  async create(c) {
    if (memClash(c.name, c.slug)) return "duplicate";
    const row = { ...c, id: newId("scat") };
    mem.push(row);
    return { ...row };
  },
  async update(id, patch) {
    const i = mem.findIndex((x) => x.id === id);
    if (i < 0) return null;
    const next = { ...mem[i], ...patch, id };
    if (memClash(next.name, next.slug, id)) return "duplicate";
    mem[i] = next;
    return { ...next };
  },
  async remove(id) { const i = mem.findIndex((x) => x.id === id); if (i < 0) return false; mem.splice(i, 1); return true; },
  async setOrder(ids) { ids.forEach((id, i) => { const c = mem.find((x) => x.id === id); if (c) c.sortOrder = (i + 1) * 10; }); },
};

/* ---- mongo ---- */
type Row = Record<string, unknown> & { _id: unknown; createdAt?: Date; updatedAt?: Date };
const isOid = (id: string) => /^[a-f0-9]{24}$/i.test(id);
const isDup = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: number }).code === 11000;
async function M() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return (await import("./service-category.model")).ServiceCategoryModel;
}
const out = (d: Row): ServiceCategory => ({
  id: String(d._id), name: String(d.name), slug: String(d.slug), icon: String(d.icon ?? "Sparkles"), description: String(d.description ?? ""),
  visible: d.visible !== false, sortOrder: Number(d.sortOrder ?? 0),
  createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : new Date().toISOString(),
  updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : new Date().toISOString(),
});

const mongoRepo: ServiceCategoryRepository = {
  async list() { const m = await M(); return (await m.find().sort({ sortOrder: 1, name: 1 }).lean<Row[]>()).map(out); },
  async get(id) { if (!isOid(id)) return null; const m = await M(); const d = await m.findById(id).lean<Row>(); return d ? out(d) : null; },
  async clash(name, slug, exceptId) {
    const m = await M();
    const not = exceptId && isOid(exceptId) ? { _id: { $ne: exceptId } } : {};
    if (await m.exists({ ...not, nameLower: lower(name) })) return "name";
    if (await m.exists({ ...not, slug })) return "slug";
    return null;
  },
  async create(c) {
    const m = await M();
    const { createdAt: _c, updatedAt: _u, ...rest } = c;
    void _c; void _u;
    try { const d = await m.create({ ...rest, nameLower: lower(c.name) }); return out(d.toObject() as Row); }
    catch (e) { if (isDup(e)) return "duplicate"; throw e; }
  },
  async update(id, patch) {
    if (!isOid(id)) return null;
    const m = await M();
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = patch;
    void _i; void _c; void _u;
    try {
      const d = await m.findByIdAndUpdate(id, { $set: { ...rest, ...(rest.name ? { nameLower: lower(rest.name) } : {}) } }, { returnDocument: "after" }).lean<Row>();
      return d ? out(d) : null;
    } catch (e) { if (isDup(e)) return "duplicate"; throw e; }
  },
  async remove(id) { if (!isOid(id)) return false; const m = await M(); return Boolean(await m.findByIdAndDelete(id).lean()); },
  async setOrder(ids) {
    const m = await M();
    const valid = ids.filter(isOid);
    if (valid.length) await m.bulkWrite(valid.map((id) => ({ updateOne: { filter: { _id: id }, update: { $set: { sortOrder: (ids.indexOf(id) + 1) * 10 } } } })));
  },
};

export function getServiceCategoryRepository(): ServiceCategoryRepository {
  return dataSourceFor("services") === "mongo" ? mongoRepo : mockRepo;
}
