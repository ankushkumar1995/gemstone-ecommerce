/**
 * Blog domain — repository.
 *
 * Two implementations behind one interface:
 *  • mock  — in-memory, seeded from `data/articles.ts`.
 *  • mongo — Mongoose model (production), soft-delete aware.
 *
 * Switch per-module with DATA_SOURCE_BLOG=mongo once articles are seeded.
 */

import { dataSourceFor } from "@/core/config/env";
import { articles as seed } from "@/data/articles";
import type { Article } from "@/types";
import type { ArticleDoc } from "./article.model";

export interface ArticleRepository {
  findAll(): Promise<Article[]>;
  findById(id: string): Promise<Article | null>;
  findBySlug(slug: string): Promise<Article | null>;
  create(article: Article): Promise<Article>;
  update(id: string, patch: Partial<Article>): Promise<Article | null>;
  remove(id: string): Promise<boolean>;
}

const store: Article[] = seed.map((a) => ({ ...a }));

function sortByDate(list: Article[]): Article[] {
  return [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const mockArticleRepository: ArticleRepository = {
  async findAll() {
    return sortByDate(store).map((a) => ({ ...a }));
  },
  async findById(id) {
    const a = store.find((x) => x.id === id);
    return a ? { ...a } : null;
  },
  async findBySlug(slug) {
    const a = store.find((x) => x.slug === slug);
    return a ? { ...a } : null;
  },
  async create(article) {
    store.unshift(article);
    return { ...article };
  },
  async update(id, patch) {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    store[idx] = { ...store[idx], ...patch };
    return { ...store[idx] };
  },
  async remove(id) {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return false;
    store.splice(idx, 1);
    return true;
  },
};

/* ------------------------------------------------------------------ *
 * Mongo (Mongoose model, soft-delete aware)
 * ------------------------------------------------------------------ */
async function model() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  const { ArticleModel } = await import("./article.model");
  await connectMongoose();
  return ArticleModel;
}

const notDeleted = { isDeleted: { $ne: true } };

function isObjectId(id: string): boolean {
  return /^[a-f0-9]{24}$/i.test(id);
}

/** Map a Mongoose lean doc → the app's Article shape. */
function fromDoc(doc: ArticleDoc): Article {
  const ts = doc as unknown as { createdAt?: Date; updatedAt?: Date };
  return {
    id: String(doc._id),
    slug: doc.slug,
    title: doc.title,
    excerpt: doc.excerpt ?? "",
    category: doc.category,
    readMins: doc.readMins ?? 1,
    image: doc.image,
    author: doc.author ?? "Astrounkle Team",
    authorRole: doc.authorRole ?? "Editorial",
    date: doc.date,
    tags: doc.tags ?? [],
    featured: Boolean(doc.featured),
    body: (doc.body ?? []).map((b) => ({
      type: b.type as Article["body"][number]["type"],
      text: b.text ?? undefined,
      items: b.items ?? undefined,
    })),
    content: doc.content ?? undefined,
    status: (doc.status ?? "draft") as Article["status"],
    seo: doc.seo
      ? {
          metaTitle: doc.seo.metaTitle ?? undefined,
          metaDescription: doc.seo.metaDescription ?? undefined,
          ogImage: doc.seo.ogImage ?? undefined,
        }
      : undefined,
    activity: (doc.activity ?? []).map((a) => ({
      id: a.id,
      at: a.at,
      type: a.type as NonNullable<Article["activity"]>[number]["type"],
      message: a.message,
      actor: a.actor ?? undefined,
    })),
    createdAt: ts.createdAt?.toISOString?.() ?? undefined,
    updatedAt: ts.updatedAt?.toISOString?.() ?? undefined,
  };
}

/** Map an app Article (service output) → a Mongo document shape. */
function toDoc(p: Partial<Article>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.slug !== undefined) out.slug = p.slug;
  if (p.title !== undefined) out.title = p.title;
  if (p.excerpt !== undefined) out.excerpt = p.excerpt;
  if (p.category !== undefined) out.category = p.category;
  if (p.readMins !== undefined) out.readMins = p.readMins;
  if (p.image !== undefined) out.image = p.image;
  if (p.author !== undefined) out.author = p.author;
  if (p.authorRole !== undefined) out.authorRole = p.authorRole;
  if (p.date !== undefined) out.date = p.date;
  if (p.tags !== undefined) out.tags = p.tags;
  if (p.featured !== undefined) out.featured = p.featured;
  if (p.body !== undefined) out.body = p.body;
  if (p.content !== undefined) out.content = p.content ?? null;
  if (p.status !== undefined) out.status = p.status;
  if (p.seo !== undefined) out.seo = p.seo ?? null;
  if (p.activity !== undefined) out.activity = p.activity;
  return out;
}

const mongoArticleRepository: ArticleRepository = {
  async findAll() {
    const M = await model();
    const docs = await M.find(notDeleted).sort({ date: -1 }).lean<ArticleDoc[]>();
    return docs.map(fromDoc);
  },
  async findById(id) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOne({ _id: id, ...notDeleted }).lean<ArticleDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async findBySlug(slug) {
    const M = await model();
    const doc = await M.findOne({ slug, ...notDeleted }).lean<ArticleDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async create(article) {
    const M = await model();
    const created = await M.create(toDoc(article));
    return fromDoc(created.toObject() as ArticleDoc);
  },
  async update(id, patch) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: toDoc(patch) },
      { new: true, runValidators: true },
    ).lean<ArticleDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async remove(id) {
    const M = await model();
    if (!isObjectId(id)) return false;
    const res = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    ).lean<ArticleDoc>();
    return Boolean(res);
  },
};

export function getArticleRepository(): ArticleRepository {
  switch (dataSourceFor("blog")) {
    case "mongo":
      return mongoArticleRepository;
    case "mock":
    default:
      return mockArticleRepository;
  }
}
