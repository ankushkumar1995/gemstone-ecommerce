/**
 * Blog domain — repository. Mock in-memory store seeded from
 * `data/articles.ts`. Swap for Mongo later via getArticleRepository().
 */

import { env } from "@/core/config/env";
import { articles as seed } from "@/data/articles";
import type { Article } from "@/types";

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

export function getArticleRepository(): ArticleRepository {
  switch (env.DATA_SOURCE) {
    case "mongo":
      throw new Error("Mongo article repository not implemented yet");
    case "mock":
    default:
      return mockArticleRepository;
  }
}
