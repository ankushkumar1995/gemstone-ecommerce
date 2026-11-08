/**
 * Poojas — repository. mock (in-memory) or mongo via DATA_SOURCE_POOJAS.
 *
 * Correctness rules enforced here, not in callers:
 *   • reserveSlot is atomic: one conditional $inc, so two people can never
 *     take the last seat (capacity null = admin overbook, no limit)
 *   • updateBooking is version-guarded: a stale write returns "conflict"
 *   • booking numbers come from an atomic yearly counter (no duplicates)
 */

import { dataSourceFor } from "@/core/config/env";
import { newId } from "@/core/id";
import { CATEGORY_LABEL, DEFAULT_CATEGORY_ICON, DEFAULT_CATEGORY_KEYS, RITUAL_TYPES, blankHavan, type RitualType, type BookingFilter, type Pandit, type Pooja, type PoojaBooking, type PoojaCategoryItem } from "./pooja.types";

/** The 11 categories that existed before categories became editable. */
function defaultCategories(): Omit<PoojaCategoryItem, "id">[] {
  const now = new Date().toISOString();
  return DEFAULT_CATEGORY_KEYS.map((key, i) => ({
    key, name: CATEGORY_LABEL[key], slug: key.replace(/_/g, "-"), icon: DEFAULT_CATEGORY_ICON[key], image: "", description: "",
    seo: { title: "", description: "" }, visible: true, sortOrder: (i + 1) * 10, createdAt: now, updatedAt: now,
  }));
}
const byOrder = (a: PoojaCategoryItem, b: PoojaCategoryItem) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

export interface PoojaStats { bookings: number; revenue: number; upcoming: number }

export interface PoojaRepository {
  listPoojas(): Promise<Pooja[]>;
  getPooja(id: string): Promise<Pooja | null>;
  getPoojaBySlug(slug: string): Promise<Pooja | null>;
  slugTaken(slug: string, exceptId?: string): Promise<boolean>;
  createPooja(p: Omit<Pooja, "id">): Promise<Pooja>;
  updatePooja(id: string, patch: Partial<Pooja>): Promise<Pooja | null>;
  deletePooja(id: string): Promise<boolean>;

  /** Seeds the default categories the first time (idempotent). */
  listCategories(): Promise<PoojaCategoryItem[]>;
  getCategory(key: string): Promise<PoojaCategoryItem | null>;
  /** "name" / "slug" when that value is already taken (case-insensitive name). */
  categoryClash(name: string, slug: string, exceptKey?: string): Promise<"name" | "slug" | null>;
  createCategory(c: Omit<PoojaCategoryItem, "id">): Promise<PoojaCategoryItem | "duplicate">;
  updateCategory(key: string, patch: Partial<PoojaCategoryItem>): Promise<PoojaCategoryItem | null | "duplicate">;
  deleteCategory(key: string): Promise<boolean>;
  setCategoryOrder(keys: string[]): Promise<void>;
  categoryCounts(): Promise<Record<string, number>>;
  /** Move every pooja from one category to another. Returns how many moved. */
  movePoojas(fromKey: string, toKey: string): Promise<number>;

  listPandits(): Promise<Pandit[]>;
  getPandit(id: string): Promise<Pandit | null>;
  phoneTaken(phone: string, exceptId?: string): Promise<boolean>;
  createPandit(p: Omit<Pandit, "id">): Promise<Pandit>;
  updatePandit(id: string, patch: Partial<Pandit>): Promise<Pandit | null>;
  deletePandit(id: string): Promise<boolean>;

  slotUsage(poojaId: string): Promise<Record<string, number>>;
  /** Take one seat. capacity null = no limit (admin overbook). */
  reserveSlot(poojaId: string, key: string, capacity: number | null): Promise<boolean>;
  releaseSlot(poojaId: string, key: string): Promise<void>;

  nextBookingNumber(year: number): Promise<string>;
  /** requestId is unique: a retried create returns "duplicate". */
  createBooking(b: Omit<PoojaBooking, "id">, requestId?: string): Promise<PoojaBooking | "duplicate">;
  getBooking(id: string): Promise<PoojaBooking | null>;
  findBookingByRequest(requestId: string): Promise<PoojaBooking | null>;
  listBookings(f: BookingFilter): Promise<PoojaBooking[]>;
  updateBooking(id: string, patch: Partial<PoojaBooking>, expectedVersion: number): Promise<PoojaBooking | null | "conflict">;
  stats(today: string): Promise<Record<string, PoojaStats>>;
  hasBookings(poojaId: string): Promise<boolean>;
  panditLoad(panditId: string, date: string, exceptBookingId?: string): Promise<number>;
  panditHasOpenBookings(panditId: string): Promise<boolean>;
}

const OPEN = ["pending_payment", "confirmed", "assigned", "in_progress"];
const LIVE = ["pending_payment", "confirmed", "assigned", "in_progress", "performed", "completed"];
const nowIso = () => new Date().toISOString();
const clone = <T>(v: T): T => structuredClone(v);
const fmtNumber = (year: number, seq: number) => `PJ-${year}-${String(seq).padStart(6, "0")}`;

function matches(b: PoojaBooking, f: BookingFilter) {
  if (f.poojaId && b.poojaId !== f.poojaId) return false;
  if (f.panditId && b.panditId !== f.panditId) return false;
  if (f.status?.length && !f.status.includes(b.status)) return false;
  if (f.from && b.slot.date < f.from) return false;
  if (f.to && b.slot.date > f.to) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    if (![b.bookingNumber, b.customer.name, b.customer.phone, b.customer.email, b.pooja.title].some((v) => v.toLowerCase().includes(q))) return false;
  }
  return true;
}

/**
 * Read-side defaults for records saved before pooja "type" existed: they are
 * poojas with default havan settings. Every pooja leaving the repository goes
 * through this, so old data never breaks newer code.
 */
function withDefaults(p: Pooja): Pooja {
  const type: RitualType = (RITUAL_TYPES as readonly string[]).includes(p.type as string) ? p.type : "pooja";
  return { ...p, type, havan: { ...blankHavan(), ...(p.havan ?? {}) } };
}
const one = (p: Pooja | null) => (p ? withDefaults(p) : null);

/* ------------------------------------------------------------------ *
 * Mock
 * ------------------------------------------------------------------ */
interface Mem { categories?: PoojaCategoryItem[]; poojas: Pooja[]; pandits: Pandit[]; bookings: (PoojaBooking & { requestId?: string })[]; slots: Map<string, number>; counters: Map<number, number> }
declare global { var __poojaMem: Mem | undefined }
const mem: Mem = global.__poojaMem ?? { poojas: [], pandits: [], bookings: [], slots: new Map(), counters: new Map() };
global.__poojaMem = mem;

const mockRepo: PoojaRepository = {
  async listPoojas() { return clone([...mem.poojas].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))).map(withDefaults); },
  async getPooja(id) { const p = mem.poojas.find((x) => x.id === id); return one(p ? clone(p) : null); },
  async getPoojaBySlug(slug) { const p = mem.poojas.find((x) => x.slug === slug); return one(p ? clone(p) : null); },
  async slugTaken(slug, exceptId) { return mem.poojas.some((x) => x.slug === slug && x.id !== exceptId); },
  async createPooja(p) { const row = { ...clone(p), id: newId("pja") }; mem.poojas.push(row); return withDefaults(clone(row)); },
  async updatePooja(id, patch) { const i = mem.poojas.findIndex((x) => x.id === id); if (i < 0) return null; mem.poojas[i] = { ...mem.poojas[i], ...clone(patch), id }; return withDefaults(clone(mem.poojas[i])); },
  async deletePooja(id) { const n = mem.poojas.length; mem.poojas = mem.poojas.filter((x) => x.id !== id); return mem.poojas.length < n; },

  async listCategories() {
    mem.categories ??= defaultCategories().map((c) => ({ ...c, id: c.key }));
    return clone([...mem.categories].sort(byOrder));
  },
  async getCategory(key) { await this.listCategories(); const c = mem.categories!.find((x) => x.key === key); return c ? clone(c) : null; },
  async categoryClash(name, slug, exceptKey) {
    const all = await this.listCategories();
    if (all.some((c) => c.key !== exceptKey && c.name.toLowerCase() === name.trim().toLowerCase())) return "name";
    if (all.some((c) => c.key !== exceptKey && c.slug === slug)) return "slug";
    return null;
  },
  async createCategory(c) {
    await this.listCategories();
    if (mem.categories!.some((x) => x.key === c.key || x.slug === c.slug || x.name.toLowerCase() === c.name.toLowerCase())) return "duplicate";
    const row = { ...clone(c), id: c.key };
    mem.categories!.push(row);
    return clone(row);
  },
  async updateCategory(key, patch) {
    await this.listCategories();
    const i = mem.categories!.findIndex((x) => x.key === key);
    if (i < 0) return null;
    const next = { ...mem.categories![i], ...clone(patch), key, id: key };
    if (mem.categories!.some((x) => x.key !== key && (x.slug === next.slug || x.name.toLowerCase() === next.name.toLowerCase()))) return "duplicate";
    mem.categories![i] = next;
    return clone(next);
  },
  async deleteCategory(key) { await this.listCategories(); const n = mem.categories!.length; mem.categories = mem.categories!.filter((x) => x.key !== key); return mem.categories.length < n; },
  async setCategoryOrder(keys) { await this.listCategories(); keys.forEach((k, i) => { const c = mem.categories!.find((x) => x.key === k); if (c) c.sortOrder = (i + 1) * 10; }); },
  async categoryCounts() { const out: Record<string, number> = {}; for (const p of mem.poojas) out[p.category] = (out[p.category] ?? 0) + 1; return out; },
  async movePoojas(fromKey, toKey) { let n = 0; for (const p of mem.poojas) if (p.category === fromKey) { p.category = toKey; n++; } return n; },

  async listPandits() { return clone([...mem.pandits].sort((a, b) => a.name.localeCompare(b.name))); },
  async getPandit(id) { const p = mem.pandits.find((x) => x.id === id); return p ? clone(p) : null; },
  async phoneTaken(phone, exceptId) { return mem.pandits.some((x) => x.phone === phone && x.id !== exceptId); },
  async createPandit(p) { const row = { ...clone(p), id: newId("pdt") }; mem.pandits.push(row); return clone(row); },
  async updatePandit(id, patch) { const i = mem.pandits.findIndex((x) => x.id === id); if (i < 0) return null; mem.pandits[i] = { ...mem.pandits[i], ...clone(patch), id }; return clone(mem.pandits[i]); },
  async deletePandit(id) { const n = mem.pandits.length; mem.pandits = mem.pandits.filter((x) => x.id !== id); return mem.pandits.length < n; },

  async slotUsage(poojaId) {
    const out: Record<string, number> = {};
    for (const [k, v] of mem.slots) if (k.startsWith(`${poojaId}:`)) out[k.slice(poojaId.length + 1)] = v;
    return out;
  },
  async reserveSlot(poojaId, key, capacity) {
    const k = `${poojaId}:${key}`;
    const cur = mem.slots.get(k) ?? 0;
    if (capacity !== null && cur >= capacity) return false;
    mem.slots.set(k, cur + 1);
    return true;
  },
  async releaseSlot(poojaId, key) { const k = `${poojaId}:${key}`; const cur = mem.slots.get(k) ?? 0; if (cur > 0) mem.slots.set(k, cur - 1); },

  async nextBookingNumber(year) { const n = (mem.counters.get(year) ?? 0) + 1; mem.counters.set(year, n); return fmtNumber(year, n); },
  async createBooking(b, requestId) {
    if (requestId && mem.bookings.some((x) => x.requestId === requestId)) return "duplicate";
    const row = { ...clone(b), id: newId("pbk"), requestId };
    mem.bookings.unshift(row);
    const { requestId: _r, ...pub } = row;
    void _r;
    return clone(pub);
  },
  async getBooking(id) { const b = mem.bookings.find((x) => x.id === id); return b ? clone(b) : null; },
  async findBookingByRequest(requestId) { const b = mem.bookings.find((x) => x.requestId === requestId); return b ? clone(b) : null; },
  async listBookings(f) { return clone(mem.bookings.filter((b) => matches(b, f)).sort((a, b) => a.slot.key.localeCompare(b.slot.key)).slice(0, f.limit ?? 500)); },
  async updateBooking(id, patch, expectedVersion) {
    const i = mem.bookings.findIndex((x) => x.id === id);
    if (i < 0) return null;
    if (mem.bookings[i].version !== expectedVersion) return "conflict";
    mem.bookings[i] = { ...mem.bookings[i], ...clone(patch), id, version: expectedVersion + 1, updatedAt: nowIso() };
    return clone(mem.bookings[i]);
  },
  async stats(today) {
    const out: Record<string, PoojaStats> = {};
    for (const b of mem.bookings) {
      const s = (out[b.poojaId] ??= { bookings: 0, revenue: 0, upcoming: 0 });
      if (b.status === "cancelled" && b.payment.status !== "paid" && b.payment.status !== "partially_refunded") continue;
      if (LIVE.includes(b.status)) s.bookings += 1;
      if (b.payment.status !== "unpaid") s.revenue += b.pricing.total - b.payment.refunded;
      if (OPEN.includes(b.status) && b.slot.date >= today) s.upcoming += 1;
    }
    return out;
  },
  async hasBookings(poojaId) { return mem.bookings.some((b) => b.poojaId === poojaId); },
  async panditLoad(panditId, date, exceptBookingId) { return mem.bookings.filter((b) => b.panditId === panditId && b.slot.date === date && b.id !== exceptBookingId && b.status !== "cancelled").length; },
  async panditHasOpenBookings(panditId) { return mem.bookings.some((b) => b.panditId === panditId && OPEN.includes(b.status)); },
};

/* ------------------------------------------------------------------ *
 * Mongo
 * ------------------------------------------------------------------ */
type Row = Record<string, unknown> & { _id: unknown; createdAt?: Date; updatedAt?: Date };
const isOid = (id: string) => /^[a-f0-9]{24}$/i.test(id);
async function M() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return import("./pooja.model");
}
function out<T>(d: Row): T {
  const { _id, createdAt, updatedAt, slotDate: _s, paymentStatus: _p, prasadStatus: _q, customerPhone: _c, razorpayOrderId: _r, requestId: _x, ...rest } = d;
  void _s; void _p; void _q; void _c; void _r; void _x;
  return { ...rest, id: String(_id), createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt ?? nowIso()), updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt ?? nowIso()) } as T;
}
function catOut(d: Row): PoojaCategoryItem {
  const { nameLower: _n, ...rest } = d;
  void _n;
  const c = out<PoojaCategoryItem>(rest as Row);
  return { ...c, id: c.key, seo: c.seo ?? { title: "", description: "" }, image: c.image ?? "", description: c.description ?? "" };
}
function strip<T extends { id?: string; createdAt?: string; updatedAt?: string }>(v: Partial<T>) {
  const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = v;
  void _i; void _c; void _u;
  return rest;
}
/** Denormalised fields for indexed queries, kept in sync on every write. */
function indexFields(b: Partial<PoojaBooking>) {
  const f: Record<string, unknown> = {};
  if (b.slot) f.slotDate = b.slot.date;
  if (b.payment) { f.paymentStatus = b.payment.status; if (b.payment.razorpayOrderId) f.razorpayOrderId = b.payment.razorpayOrderId; }
  if (b.prasad) f.prasadStatus = b.prasad.status;
  if (b.customer) f.customerPhone = b.customer.phone;
  return f;
}
const isDup = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: number }).code === 11000;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const mongoRepo: PoojaRepository = {
  async listPoojas() { const { PoojaModel } = await M(); return (await PoojaModel.find().sort({ sortOrder: 1, title: 1 }).lean<Row[]>()).map((d) => withDefaults(out<Pooja>(d))); },
  async getPooja(id) { if (!isOid(id)) return null; const { PoojaModel } = await M(); const d = await PoojaModel.findById(id).lean<Row>(); return d ? withDefaults(out<Pooja>(d)) : null; },
  async getPoojaBySlug(slug) { const { PoojaModel } = await M(); const d = await PoojaModel.findOne({ slug }).lean<Row>(); return d ? withDefaults(out<Pooja>(d)) : null; },
  async slugTaken(slug, exceptId) { const { PoojaModel } = await M(); const q: Record<string, unknown> = { slug }; if (exceptId && isOid(exceptId)) q._id = { $ne: exceptId }; return Boolean(await PoojaModel.exists(q)); },
  async createPooja(p) { const { PoojaModel } = await M(); const d = await PoojaModel.create(strip<Pooja>(p)); return withDefaults(out<Pooja>(d.toObject() as Row)); },
  async updatePooja(id, patch) { if (!isOid(id)) return null; const { PoojaModel } = await M(); const d = await PoojaModel.findByIdAndUpdate(id, { $set: strip<Pooja>(patch) }, { returnDocument: "after" }).lean<Row>(); return d ? withDefaults(out<Pooja>(d)) : null; },
  async deletePooja(id) { if (!isOid(id)) return false; const { PoojaModel } = await M(); return Boolean(await PoojaModel.findByIdAndDelete(id).lean()); },

  async listCategories() {
    const { PoojaCategoryModel } = await M();
    if ((await PoojaCategoryModel.estimatedDocumentCount()) === 0) {
      // Upsert by key: two servers seeding at once can never create duplicates.
      await PoojaCategoryModel.bulkWrite(defaultCategories().map((c) => ({
        updateOne: { filter: { key: c.key }, update: { $setOnInsert: { ...strip<PoojaCategoryItem>(c), nameLower: c.name.toLowerCase() } }, upsert: true },
      })), { ordered: false }).catch((e) => { if (!isDup(e)) throw e; });
    }
    return (await PoojaCategoryModel.find().sort({ sortOrder: 1, name: 1 }).lean<Row[]>()).map(catOut);
  },
  async getCategory(key) { const { PoojaCategoryModel } = await M(); await this.listCategories(); const d = await PoojaCategoryModel.findOne({ key }).lean<Row>(); return d ? catOut(d) : null; },
  async categoryClash(name, slug, exceptKey) {
    const { PoojaCategoryModel } = await M();
    const not = exceptKey ? { key: { $ne: exceptKey } } : {};
    if (await PoojaCategoryModel.exists({ ...not, nameLower: name.trim().toLowerCase() })) return "name";
    if (await PoojaCategoryModel.exists({ ...not, slug })) return "slug";
    return null;
  },
  async createCategory(c) {
    const { PoojaCategoryModel } = await M();
    try { const d = await PoojaCategoryModel.create({ ...strip<PoojaCategoryItem>(c), nameLower: c.name.toLowerCase() }); return catOut(d.toObject() as Row); }
    catch (e) { if (isDup(e)) return "duplicate"; throw e; }
  },
  async updateCategory(key, patch) {
    const { PoojaCategoryModel } = await M();
    const { key: _k, ...rest } = strip<PoojaCategoryItem>(patch);
    void _k;
    try {
      const d = await PoojaCategoryModel.findOneAndUpdate({ key }, { $set: { ...rest, ...(rest.name ? { nameLower: rest.name.toLowerCase() } : {}) } }, { returnDocument: "after" }).lean<Row>();
      return d ? catOut(d) : null;
    } catch (e) { if (isDup(e)) return "duplicate"; throw e; }
  },
  async deleteCategory(key) { const { PoojaCategoryModel } = await M(); return (await PoojaCategoryModel.deleteOne({ key })).deletedCount === 1; },
  async setCategoryOrder(keys) {
    const { PoojaCategoryModel } = await M();
    if (keys.length) await PoojaCategoryModel.bulkWrite(keys.map((k, i) => ({ updateOne: { filter: { key: k }, update: { $set: { sortOrder: (i + 1) * 10 } } } })));
  },
  async categoryCounts() {
    const { PoojaModel } = await M();
    const rows = await PoojaModel.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$category", n: { $sum: 1 } } }]);
    return Object.fromEntries(rows.map((r) => [r._id, r.n]));
  },
  async movePoojas(fromKey, toKey) { const { PoojaModel } = await M(); return (await PoojaModel.updateMany({ category: fromKey }, { $set: { category: toKey } })).modifiedCount; },

  async listPandits() { const { PanditModel } = await M(); return (await PanditModel.find().sort({ name: 1 }).lean<Row[]>()).map((d) => out<Pandit>(d)); },
  async getPandit(id) { if (!isOid(id)) return null; const { PanditModel } = await M(); const d = await PanditModel.findById(id).lean<Row>(); return d ? out<Pandit>(d) : null; },
  async phoneTaken(phone, exceptId) { const { PanditModel } = await M(); const q: Record<string, unknown> = { phone }; if (exceptId && isOid(exceptId)) q._id = { $ne: exceptId }; return Boolean(await PanditModel.exists(q)); },
  async createPandit(p) { const { PanditModel } = await M(); const d = await PanditModel.create(strip<Pandit>(p)); return out<Pandit>(d.toObject() as Row); },
  async updatePandit(id, patch) { if (!isOid(id)) return null; const { PanditModel } = await M(); const d = await PanditModel.findByIdAndUpdate(id, { $set: strip<Pandit>(patch) }, { returnDocument: "after" }).lean<Row>(); return d ? out<Pandit>(d) : null; },
  async deletePandit(id) { if (!isOid(id)) return false; const { PanditModel } = await M(); return Boolean(await PanditModel.findByIdAndDelete(id).lean()); },

  async slotUsage(poojaId) {
    const { PoojaSlotModel } = await M();
    const rows = await PoojaSlotModel.find({ poojaId }).lean<{ key: string; booked: number }[]>();
    return Object.fromEntries(rows.map((r) => [r.key.slice(poojaId.length + 1), r.booked]));
  },
  async reserveSlot(poojaId, key, capacity) {
    const { PoojaSlotModel } = await M();
    const k = `${poojaId}:${key}`;
    await PoojaSlotModel.updateOne({ key: k }, { $setOnInsert: { key: k, poojaId, booked: 0 } }, { upsert: true }).catch((e) => { if (!isDup(e)) throw e; });
    const filter: Record<string, unknown> = { key: k };
    if (capacity !== null) filter.booked = { $lt: capacity };
    const r = await PoojaSlotModel.updateOne(filter, { $inc: { booked: 1 } });
    return r.modifiedCount === 1;
  },
  async releaseSlot(poojaId, key) { const { PoojaSlotModel } = await M(); await PoojaSlotModel.updateOne({ key: `${poojaId}:${key}`, booked: { $gt: 0 } }, { $inc: { booked: -1 } }); },

  async nextBookingNumber(year) {
    const { PoojaCounterModel } = await M();
    const d = await PoojaCounterModel.findOneAndUpdate({ _id: `booking-${year}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" }).lean<{ seq: number }>();
    return fmtNumber(year, d?.seq ?? 1);
  },
  async createBooking(b, requestId) {
    const { PoojaBookingModel } = await M();
    try {
      const d = await PoojaBookingModel.create({ ...strip<PoojaBooking>(b), ...indexFields(b), ...(requestId ? { requestId } : {}) });
      return out<PoojaBooking>(d.toObject() as Row);
    } catch (e) {
      if (isDup(e) && requestId && (await PoojaBookingModel.exists({ requestId }))) return "duplicate";
      throw e;
    }
  },
  async getBooking(id) { if (!isOid(id)) return null; const { PoojaBookingModel } = await M(); const d = await PoojaBookingModel.findById(id).lean<Row>(); return d ? out<PoojaBooking>(d) : null; },
  async findBookingByRequest(requestId) { const { PoojaBookingModel } = await M(); const d = await PoojaBookingModel.findOne({ requestId }).lean<Row>(); return d ? out<PoojaBooking>(d) : null; },
  async listBookings(f) {
    const { PoojaBookingModel } = await M();
    const q: Record<string, unknown> = {};
    if (f.poojaId) q.poojaId = f.poojaId;
    if (f.panditId) q.panditId = f.panditId;
    if (f.status?.length) q.status = { $in: f.status };
    if (f.from || f.to) q.slotDate = { ...(f.from ? { $gte: f.from } : {}), ...(f.to ? { $lte: f.to } : {}) };
    if (f.q) { const re = new RegExp(escapeRe(f.q), "i"); q.$or = [{ bookingNumber: re }, { "customer.name": re }, { customerPhone: re }, { "customer.email": re }, { "pooja.title": re }]; }
    const rows = await PoojaBookingModel.find(q).sort({ slotDate: 1, "slot.time": 1 }).limit(Math.min(f.limit ?? 500, 1000)).lean<Row[]>();
    return rows.map((d) => out<PoojaBooking>(d));
  },
  async updateBooking(id, patch, expectedVersion) {
    if (!isOid(id)) return null;
    const { PoojaBookingModel } = await M();
    const d = await PoojaBookingModel.findOneAndUpdate(
      { _id: id, version: expectedVersion },
      { $set: { ...strip<PoojaBooking>(patch), ...indexFields(patch) }, $inc: { version: 1 } },
      { returnDocument: "after" },
    ).lean<Row>();
    if (d) return out<PoojaBooking>(d);
    return (await PoojaBookingModel.exists({ _id: id })) ? "conflict" : null;
  },
  async stats(today) {
    const { PoojaBookingModel } = await M();
    const rows = await PoojaBookingModel.aggregate<{ _id: string; bookings: number; revenue: number; upcoming: number }>([
      { $group: {
        _id: "$poojaId",
        bookings: { $sum: { $cond: [{ $in: ["$status", LIVE] }, 1, 0] } },
        revenue: { $sum: { $cond: [{ $ne: ["$paymentStatus", "unpaid"] }, { $subtract: ["$pricing.total", "$payment.refunded"] }, 0] } },
        upcoming: { $sum: { $cond: [{ $and: [{ $in: ["$status", OPEN] }, { $gte: ["$slotDate", today] }] }, 1, 0] } },
      } },
    ]);
    return Object.fromEntries(rows.map((r) => [r._id, { bookings: r.bookings, revenue: r.revenue, upcoming: r.upcoming }]));
  },
  async hasBookings(poojaId) { const { PoojaBookingModel } = await M(); return Boolean(await PoojaBookingModel.exists({ poojaId })); },
  async panditLoad(panditId, date, exceptBookingId) {
    const { PoojaBookingModel } = await M();
    const q: Record<string, unknown> = { panditId, slotDate: date, status: { $ne: "cancelled" } };
    if (exceptBookingId && isOid(exceptBookingId)) q._id = { $ne: exceptBookingId };
    return PoojaBookingModel.countDocuments(q);
  },
  async panditHasOpenBookings(panditId) { const { PoojaBookingModel } = await M(); return Boolean(await PoojaBookingModel.exists({ panditId, status: { $in: OPEN } })); },
};

export function getPoojaRepository(): PoojaRepository {
  return dataSourceFor("poojas") === "mongo" ? mongoRepo : mockRepo;
}
