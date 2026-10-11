"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ArrowUpRight, Search, Calendar } from "lucide-react";
import type { Article } from "@/types";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function BlogListView({
  articles,
  categories,
}: {
  articles: Article[];
  categories: string[];
}) {
  const [cat, setCat] = useState<string>("All");
  const [q, setQ] = useState("");

  const featured = articles.find((a) => a.featured) ?? articles[0];

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return articles
      .filter((a) => (featured ? a.slug !== featured.slug : true))
      .filter((a) => (cat === "All" ? true : a.category === cat))
      .filter((a) =>
        term === ""
          ? true
          : (a.title + a.excerpt + a.tags.join(" ")).toLowerCase().includes(term)
      );
  }, [articles, cat, q, featured]);

  return (
    <Container className="py-8 sm:py-10">
      <Breadcrumb items={[{ label: "Blog" }]} className="mb-6" />

      {/* header */}
      <div className="text-center">
        <div className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-gold-500">
          <span className="h-px w-6 bg-gradient-to-r from-transparent to-gold-400" />
          Learn & Grow
          <span className="h-px w-6 bg-gradient-to-l from-transparent to-gold-400" />
        </div>
        <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">
          The Gemstone <span className="text-gradient-gold">Journal</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          Guides, astrology insights and buying tips from our experts.
        </p>
      </div>

      {/* featured */}
      {featured && (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mt-10"
      >
        <Link
          href={`/blog/${featured.slug}`}
          className="group grid overflow-hidden rounded-[2rem] border border-foreground/10 bg-nebula lg:grid-cols-2"
        >
          <div className="relative aspect-[16/10] overflow-hidden lg:aspect-auto">
            <Image
              src={featured.image}
              alt={featured.title}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <span className="absolute left-4 top-4 rounded-full bg-gold-400 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              Featured
            </span>
          </div>
          <div className="flex flex-col justify-center p-7 sm:p-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-royal-600">
              {featured.category}
            </span>
            <h2 className="mt-3 text-2xl font-semibold leading-snug text-foreground transition-colors group-hover:text-gold-600 sm:text-3xl">
              {featured.title}
            </h2>
            <p className="mt-3 text-muted">{featured.excerpt}</p>
            <div className="mt-5 flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} /> {formatDate(featured.date)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={13} /> {featured.readMins} min read
              </span>
            </div>
            <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-600">
              Read article
              <ArrowUpRight
                size={15}
                className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </span>
          </div>
        </Link>
      </motion.div>
      )}

      {/* filters */}
      <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {["All", ...categories].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                cat === c
                  ? "border-gold-400/60 bg-gold-400/12 text-gold-600"
                  : "border-foreground/12 bg-nebula text-muted hover:text-foreground"
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-full border border-foreground/15 bg-nebula px-4 py-2 sm:w-64">
          <Search size={16} className="shrink-0 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search articles…"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
          />
        </div>
      </div>

      {/* grid */}
      {list.length === 0 ? (
        <p className="py-20 text-center text-muted">
          No articles found. Try a different category or search.
        </p>
      ) : (
        <motion.div layout className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {list.map((a) => (
              <motion.article
                key={a.slug}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3 }}
              >
                <Link
                  href={`/blog/${a.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-nebula transition-all duration-500 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_26px_60px_-28px_rgba(36,26,59,0.45)]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image
                      src={a.image}
                      alt={a.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-nebula/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-royal-600 backdrop-blur-sm">
                      {a.category}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={12} /> {formatDate(a.date)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={12} /> {a.readMins} min
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-gold-600">
                      {a.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted">
                      {a.excerpt}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-600">
                      Read more
                      <ArrowUpRight
                        size={15}
                        className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      />
                    </span>
                  </div>
                </Link>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </Container>
  );
}
