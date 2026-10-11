/**
 * Blog domain — service. Admin CRUD + the read helpers the storefront needs
 * (published list, by-slug, related, categories). Returns Result<T>.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import type { Article, ArticleActivity, ArticleBlock } from "@/types";
import { getArticleRepository } from "./article.repository";
import type { CreateArticleDto, UpdateArticleDto } from "./article.schema";

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1611425143678-08fc480cafde?auto=format&fit=crop&w=1600&q=85";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function logEntry(type: ArticleActivity["type"], message: string): ArticleActivity {
  return { id: newId("bact"), at: new Date().toISOString(), type, message, actor: "Admin" };
}

/** Estimate read time (~200 wpm) from blocks and/or rich HTML content. */
function estimateReadMins(body: ArticleBlock[], content?: string): number {
  const blockWords = body.reduce((n, b) => {
    const t = b.text ?? "";
    const items = (b.items ?? []).join(" ");
    return n + `${t} ${items}`.trim().split(/\s+/).filter(Boolean).length;
  }, 0);
  const htmlWords = content
    ? content.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length
    : 0;
  const words = Math.max(blockWords, htmlWords);
  return Math.max(1, Math.round(words / 200));
}

export const articleService = {
  /* ---------------- admin ---------------- */
  async list(): Promise<Result<Article[]>> {
    const repo = getArticleRepository();
    return ok(await repo.findAll());
  },

  async getById(id: string): Promise<Result<Article>> {
    const repo = getArticleRepository();
    const a = await repo.findById(id);
    if (!a) return fail(AppErrors.notFound("Article not found"));
    return ok(a);
  },

  async create(dto: CreateArticleDto): Promise<Result<Article>> {
    const repo = getArticleRepository();
    let slug = slugify(dto.title);
    if (await repo.findBySlug(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const body = dto.body ?? [];
    const content = dto.content || undefined;
    const article: Article = {
      id: newId("art"),
      slug,
      title: dto.title.trim(),
      excerpt: dto.excerpt?.trim() || "",
      category: dto.category.trim(),
      readMins: dto.readMins ?? estimateReadMins(body, content),
      image: dto.image?.trim() || PLACEHOLDER_IMAGE,
      author: dto.author?.trim() || "Nakshatra Team",
      authorRole: dto.authorRole?.trim() || "Editorial",
      date: dto.date || new Date().toISOString(),
      tags: dto.tags ?? [],
      featured: dto.featured ?? false,
      body,
      content,
      status: dto.status ?? "draft",
      seo: dto.seo
        ? {
            metaTitle: dto.seo.metaTitle || undefined,
            metaDescription: dto.seo.metaDescription || undefined,
            ogImage: dto.seo.ogImage || undefined,
          }
        : undefined,
      activity: [logEntry("created", "Article created")],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return ok(await repo.create(article));
  },

  async update(id: string, dto: UpdateArticleDto): Promise<Result<Article>> {
    const repo = getArticleRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Article not found"));

    const body = dto.body ?? existing.body;
    const content = dto.content !== undefined ? dto.content || undefined : existing.content;
    const patch: Partial<Article> = {
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.excerpt !== undefined && { excerpt: dto.excerpt.trim() }),
      ...(dto.category !== undefined && { category: dto.category.trim() }),
      ...(dto.image !== undefined && dto.image !== "" && { image: dto.image.trim() }),
      ...(dto.author !== undefined && { author: dto.author.trim() || existing.author }),
      ...(dto.authorRole !== undefined && { authorRole: dto.authorRole.trim() || existing.authorRole }),
      ...(dto.date !== undefined && dto.date !== "" && { date: dto.date }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
      ...(dto.featured !== undefined && { featured: dto.featured }),
      ...(dto.body !== undefined && { body }),
      ...(dto.content !== undefined && { content }),
      ...((dto.body !== undefined || dto.content !== undefined) && {
        readMins: dto.readMins ?? estimateReadMins(body, content),
      }),
      ...(dto.readMins !== undefined && { readMins: dto.readMins }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.seo !== undefined && {
        seo: {
          metaTitle: dto.seo.metaTitle || undefined,
          metaDescription: dto.seo.metaDescription || undefined,
          ogImage: dto.seo.ogImage || undefined,
        },
      }),
      updatedAt: new Date().toISOString(),
    };

    const entries: ArticleActivity[] = [];
    if (dto.status !== undefined && dto.status !== existing.status) {
      entries.push(logEntry("status", `Status changed from "${existing.status}" to "${dto.status}"`));
    }
    if (entries.length === 0) entries.push(logEntry("updated", "Article updated"));
    patch.activity = [...entries, ...(existing.activity ?? [])].slice(0, 50);

    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Article not found"));
    return ok(updated);
  },

  async remove(id: string): Promise<Result<{ id: string }>> {
    const repo = getArticleRepository();
    const removed = await repo.remove(id);
    if (!removed) return fail(AppErrors.notFound("Article not found"));
    return ok({ id });
  },

  /* ---------------- storefront (published only) ---------------- */
  async listPublished(): Promise<Result<Article[]>> {
    const repo = getArticleRepository();
    const all = await repo.findAll();
    return ok(all.filter((a) => a.status === "published"));
  },

  async getPublishedBySlug(slug: string): Promise<Result<Article>> {
    const repo = getArticleRepository();
    const a = await repo.findBySlug(slug);
    if (!a || a.status !== "published") return fail(AppErrors.notFound("Article not found"));
    return ok(a);
  },

  async related(slug: string, limit = 3): Promise<Result<Article[]>> {
    const repo = getArticleRepository();
    const all = (await repo.findAll()).filter((a) => a.status === "published");
    const current = all.find((a) => a.slug === slug);
    if (!current) return ok(all.slice(0, limit));
    const same = all.filter((a) => a.slug !== slug && a.category === current.category);
    const others = all.filter((a) => a.slug !== slug && a.category !== current.category);
    return ok([...same, ...others].slice(0, limit));
  },
};
