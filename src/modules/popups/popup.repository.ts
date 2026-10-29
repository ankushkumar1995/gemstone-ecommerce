/**
 * Popups domain — repository.
 *
 * Two implementations behind one interface:
 *  • mock  — in-memory (empty by default; popups are created via admin).
 *  • mongo — Mongoose model (production), soft-delete aware.
 *
 * Switched by dataSourceFor("popups") → set DATA_SOURCE_POPUPS=mongo in .env.
 */

import { dataSourceFor } from "@/core/config/env";
import type { Popup, PopupEvent } from "./popup.types";
import type { PopupDoc } from "./popup.model";

export interface PopupRepository {
  findAll(): Promise<Popup[]>;
  findById(id: string): Promise<Popup | null>;
  create(popup: Popup): Promise<Popup>;
  update(id: string, patch: Partial<Popup>): Promise<Popup | null>;
  remove(id: string): Promise<boolean>;
  /** Fire-and-forget-ish analytics bump. Returns false if popup missing. */
  incEvent(id: string, event: PopupEvent): Promise<boolean>;
}

/* ------------------------------------------------------------------ *
 * Mock (in-memory)
 * ------------------------------------------------------------------ */
const store: Popup[] = [];

const mockPopupRepository: PopupRepository = {
  async findAll() {
    return store.map((p) => ({ ...p }));
  },
  async findById(id) {
    const p = store.find((x) => x.id === id);
    return p ? { ...p } : null;
  },
  async create(popup) {
    store.unshift(popup);
    return { ...popup };
  },
  async update(id, patch) {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    store[idx] = { ...store[idx], ...patch, updatedAt: new Date().toISOString() };
    return { ...store[idx] };
  },
  async remove(id) {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return false;
    store.splice(idx, 1);
    return true;
  },
  async incEvent(id, event) {
    const p = store.find((x) => x.id === id);
    if (!p) return false;
    const key = (
      {
        impression: "impressions",
        click: "clicks",
        dismiss: "dismissals",
        submission: "submissions",
      } as const
    )[event];
    p.analytics = { ...p.analytics, [key]: (p.analytics[key] ?? 0) + 1 };
    return true;
  },
};

/* ------------------------------------------------------------------ *
 * Mongo (Mongoose model, soft-delete aware)
 * ------------------------------------------------------------------ */
async function model() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  const { PopupModel } = await import("./popup.model");
  await connectMongoose();
  return PopupModel;
}

const notDeleted = { isDeleted: { $ne: true } };

function isObjectId(id: string): boolean {
  return /^[a-f0-9]{24}$/i.test(id);
}

function fromDoc(doc: PopupDoc): Popup {
  const ts = doc as unknown as { createdAt?: Date; updatedAt?: Date };
  return {
    id: String(doc._id),
    name: doc.name,
    type: doc.type as Popup["type"],
    enabled: Boolean(doc.enabled),
    priority: doc.priority ?? 0,
    content: {
      heading: doc.content?.heading || undefined,
      body: doc.content?.body || undefined,
      image: doc.content?.image || undefined,
      html: doc.content?.html || undefined,
      couponCode: doc.content?.couponCode || undefined,
      emailPlaceholder: doc.content?.emailPlaceholder || undefined,
      submitLabel: doc.content?.submitLabel || undefined,
      successMessage: doc.content?.successMessage || undefined,
      ctas: (doc.content?.ctas ?? []).map((c) => ({
        label: c.label ?? "",
        href: c.href ?? "",
        style: (c.style ?? "primary") as Popup["content"]["ctas"][number]["style"],
      })),
    },
    design: {
      layout: (doc.design?.layout ?? "center") as Popup["design"]["layout"],
      corner: (doc.design?.corner ?? "bottom-right") as Popup["design"]["corner"],
      width: (doc.design?.width ?? "md") as Popup["design"]["width"],
      radius: (doc.design?.radius ?? "soft") as Popup["design"]["radius"],
      imageOnly: doc.design?.imageOnly ?? false,
      accentColor: doc.design?.accentColor || undefined,
      backgroundColor: doc.design?.backgroundColor || undefined,
      textColor: doc.design?.textColor || undefined,
      overlay: doc.design?.overlay ?? true,
      showClose: doc.design?.showClose ?? true,
      closeOnOverlayClick: doc.design?.closeOnOverlayClick ?? true,
      closeOnEsc: doc.design?.closeOnEsc ?? true,
    },
    targeting: {
      pageMode: (doc.targeting?.pageMode ?? "all") as Popup["targeting"]["pageMode"],
      pagePaths: doc.targeting?.pagePaths ?? [],
      device: (doc.targeting?.device ?? "all") as Popup["targeting"]["device"],
      audience: (doc.targeting?.audience ?? "all") as Popup["targeting"]["audience"],
      auth: (doc.targeting?.auth ?? "all") as Popup["targeting"]["auth"],
    },
    trigger: {
      type: (doc.trigger?.type ?? "delay") as Popup["trigger"]["type"],
      delaySeconds: doc.trigger?.delaySeconds ?? 3,
      scrollPercent: doc.trigger?.scrollPercent ?? 50,
    },
    frequencyRule: {
      frequency: (doc.frequencyRule?.frequency ?? "once-per-session") as Popup["frequencyRule"]["frequency"],
      everyNDays: doc.frequencyRule?.everyNDays ?? 7,
      showAgainAfterDismissHours: doc.frequencyRule?.showAgainAfterDismissHours ?? 0,
    },
    analytics: {
      impressions: doc.analytics?.impressions ?? 0,
      clicks: doc.analytics?.clicks ?? 0,
      dismissals: doc.analytics?.dismissals ?? 0,
      submissions: doc.analytics?.submissions ?? 0,
    },
    startAt: doc.startAt ?? undefined,
    endAt: doc.endAt ?? undefined,
    createdAt: ts.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: ts.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

/** Build a Mongo $set doc from a partial Popup (only provided keys). */
function toDoc(p: Partial<Popup>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.type !== undefined) out.type = p.type;
  if (p.enabled !== undefined) out.enabled = p.enabled;
  if (p.priority !== undefined) out.priority = p.priority;
  if (p.content !== undefined) out.content = p.content;
  if (p.design !== undefined) out.design = p.design;
  if (p.targeting !== undefined) out.targeting = p.targeting;
  if (p.trigger !== undefined) out.trigger = p.trigger;
  if (p.frequencyRule !== undefined) out.frequencyRule = p.frequencyRule;
  if (p.analytics !== undefined) out.analytics = p.analytics;
  if (p.startAt !== undefined) out.startAt = p.startAt ?? null;
  if (p.endAt !== undefined) out.endAt = p.endAt ?? null;
  return out;
}

const EVENT_FIELD: Record<PopupEvent, string> = {
  impression: "analytics.impressions",
  click: "analytics.clicks",
  dismiss: "analytics.dismissals",
  submission: "analytics.submissions",
};

const mongoPopupRepository: PopupRepository = {
  async findAll() {
    const M = await model();
    const docs = await M.find(notDeleted).sort({ priority: -1, createdAt: -1 }).lean<PopupDoc[]>();
    return docs.map(fromDoc);
  },
  async findById(id) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOne({ _id: id, ...notDeleted }).lean<PopupDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async create(popup) {
    const M = await model();
    const created = await M.create(toDoc(popup));
    return fromDoc(created.toObject() as PopupDoc);
  },
  async update(id, patch) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: toDoc(patch) },
      { new: true, runValidators: true },
    ).lean<PopupDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async remove(id) {
    const M = await model();
    if (!isObjectId(id)) return false;
    const res = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    ).lean<PopupDoc>();
    return Boolean(res);
  },
  async incEvent(id, event) {
    const M = await model();
    if (!isObjectId(id)) return false;
    const res = await M.updateOne(
      { _id: id, ...notDeleted },
      { $inc: { [EVENT_FIELD[event]]: 1 } },
    );
    return res.matchedCount > 0;
  },
};

export function getPopupRepository(): PopupRepository {
  switch (dataSourceFor("popups")) {
    case "mongo":
      return mongoPopupRepository;
    case "mock":
    default:
      return mockPopupRepository;
  }
}
