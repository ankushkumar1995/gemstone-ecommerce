"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  ArrowUpRight,
  Search,
  Calendar,
  X,
  LayoutGrid,
  Hash,
  Flame,
  Sparkles,
  PhoneCall,
  ChevronDown,
} from "lucide-react";
import type { Article } from "@/types";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

const PAGE = 6;
const EASE = [0.22, 1, 0.36, 1] as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ *
 * Sidebar building blocks
 * ------------------------------------------------------------------ */

function Widget({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Hash;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-foreground/10 bg-nebula p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold-400/15 text-gold-600">
          <Icon size={14} />
        </span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function SearchBox({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-foreground/15 bg-white px-4 py-2.5 transition-colors focus-within:border-gold-400/60">
      <Search size={16} className="shrink-0 text-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search articles…"
        aria-label="Search articles"
        className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ("")}
          aria-label="Clear search"
          className="text-muted transition-colors hover:text-foreground"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Cards
 * ------------------------------------------------------------------ */

function Meta({ a, size = 13 }: { a: Article; size?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <Calendar size={size} /> {formatDate(a.date)}
      </span>
      <span className="flex items-center gap-1.5">
        <Clock size={size} /> {a.readMins} min read
      </span>
    </div>
  );
}

function PostCard({ a }: { a: Article }) {
  return (
    <Link
      href={`/blog/${a.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-nebula transition-all duration-500 hover:-translate-y-1 hover:border-gold-400/40 hover:shadow-[0_26px_60px_-28px_rgba(36,26,59,0.45)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={a.image}
          alt={a.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 30vw"
          className="object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {a.featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold-400 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              <Sparkles size={11} /> Featured
            </span>
          )}
          <span className="rounded-full bg-nebula/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-royal-600 backdrop-blur-sm">
            {a.category}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <Meta a={a} size={12} />
        <h3 className="mt-2.5 text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-gold-600">
          {a.title}
        </h3>
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted">{a.excerpt}</p>
        <div className="mt-4 flex items-center justify-between border-t border-foreground/10 pt-3.5">
          <span className="truncate pr-3 text-xs text-muted">
            By <span className="font-medium text-foreground">{a.author}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-gold-600">
            Read
            <ArrowUpRight
              size={15}
              className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ *
 * Page view
 * ------------------------------------------------------------------ */

export function BlogListView({
  articles,
  categories,
}: {
  articles: Article[];
  categories: string[];
}) {
  const [cat, setCat] = useState<string>("All");
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(PAGE);

  // filter changes always restart the paging
  const pickCat = (c: string) => {
    setCat(c);
    setVisible(PAGE);
  };
  const search = (v: string) => {
    setQ(v);
    setVisible(PAGE);
  };

  const term = q.trim().toLowerCase();
  const filtering = cat !== "All" || term !== "";

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of articles) m.set(a.category, (m.get(a.category) ?? 0) + 1);
    return m;
  }, [articles]);

  const recent = useMemo(
    () => [...articles].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4),
    [articles]
  );

  const tags = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of articles) for (const t of a.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 12).map(([t]) => t);
  }, [articles]);

  const list = useMemo(() => {
    return articles
      .filter((a) => (cat === "All" ? true : a.category === cat))
      .filter((a) =>
        term === ""
          ? true
          : (a.title + " " + a.excerpt + " " + a.tags.join(" ")).toLowerCase().includes(term)
      )
      // same card for every post; featured ones simply come first
      .sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
  }, [articles, cat, term]);

  const shown = list.slice(0, visible);

  return (
    <>
      {/* ---- Header (banner art: clear left side for text, props on the right) ---- */}
      <section className="relative isolate overflow-hidden border-b border-gold-400/20 bg-[#fbf3ea]">
        <motion.div
          aria-hidden
          className="absolute inset-0 -z-10"
          initial={{ scale: 1.06, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: EASE }}
        >
          <Image
            src="/images/blog-banner.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-right"
          />
        </motion.div>
        {/* desktop: soft wash on the left so the text always reads clearly */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-white/80 via-white/45 to-transparent md:block"
        />
        {/* small screens: props sit behind the text, so fade more */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-white/65 md:hidden" />

        <Container className="pt-6">
          <Breadcrumb items={[{ label: "Blog" }]} />
        </Container>
        <Container className="relative pb-14 pt-8 sm:pb-20 sm:pt-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="max-w-xl"
          >
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-gold-500">
              <span className="h-px w-6 bg-gradient-to-r from-transparent to-gold-400" />
              Learn & Grow
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
              The Gemstone <span className="text-gradient-gold">Journal</span>
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-foreground/75">
              Guides, astrology insights and buying tips from our experts.
            </p>
          </motion.div>
        </Container>
      </section>

      <Container className="py-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[290px_minmax(0,1fr)] xl:gap-10">
          {/* ================= Sidebar (left on desktop, below posts on mobile) ================= */}
          <aside className="order-2 lg:order-1">
            <div className="space-y-5 lg:sticky lg:top-24">
              <div className="hidden lg:block">
                <SearchBox q={q} setQ={search} />
              </div>

              <div className="hidden lg:block">
                <Widget title="Categories" icon={LayoutGrid}>
                  <ul className="space-y-1">
                    {["All", ...categories].map((c) => {
                      const active = cat === c;
                      const n = c === "All" ? articles.length : counts.get(c) ?? 0;
                      return (
                        <li key={c}>
                          <button
                            type="button"
                            onClick={() => pickCat(c)}
                            aria-pressed={active}
                            className={cn(
                              "group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors",
                              active
                                ? "bg-gold-400/12 font-semibold text-gold-600"
                                : "text-foreground/75 hover:bg-foreground/[0.04] hover:text-foreground"
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full transition-colors",
                                  active ? "bg-gold-500" : "bg-foreground/20 group-hover:bg-gold-400"
                                )}
                              />
                              {c === "All" ? "All articles" : c}
                            </span>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                active ? "bg-gold-400 text-white" : "bg-foreground/[0.06] text-muted"
                              )}
                            >
                              {n}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Widget>
              </div>

              {recent.length > 0 && (
                <Widget title="Recent posts" icon={Flame}>
                  <ul className="space-y-3.5">
                    {recent.map((a) => (
                      <li key={a.slug}>
                        <Link href={`/blog/${a.slug}`} className="group flex items-center gap-3">
                          <span className="relative h-14 w-16 shrink-0 overflow-hidden rounded-xl">
                            <Image
                              src={a.image}
                              alt=""
                              fill
                              sizes="64px"
                              className="object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          </span>
                          <span className="min-w-0">
                            <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-gold-600">
                              {a.title}
                            </span>
                            <span className="mt-1 block text-[11px] text-muted">{formatDate(a.date)}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Widget>
              )}

              {tags.length > 0 && (
                <Widget title="Popular tags" icon={Hash}>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((t) => {
                      const active = term === t.toLowerCase();
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => search(active ? "" : t)}
                          aria-pressed={active}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            active
                              ? "border-gold-400/60 bg-gold-400/12 text-gold-600"
                              : "border-foreground/12 text-foreground/70 hover:border-gold-400/50 hover:text-gold-600"
                          )}
                        >
                          #{t}
                        </button>
                      );
                    })}
                  </div>
                </Widget>
              )}

              {/* consult CTA */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2a1d47] via-[#3a2766] to-[#241a3b] p-6 text-white">
                <div
                  aria-hidden
                  className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gold-400/30 blur-3xl"
                />
                <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
                  Need guidance?
                </p>
                <h3 className="relative mt-2 text-lg font-semibold leading-snug">
                  Talk to an expert astrologer
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed text-white/75">
                  Get a personal reading for your chart, gemstone or remedy.
                </p>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="relative mt-4 inline-block">
                  <Link
                    href="/consultation"
                    className="inline-flex items-center gap-2 rounded-full bg-gold-400 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(212,160,23,0.8)] transition-colors hover:bg-gold-500"
                  >
                    <PhoneCall size={14} /> Book Consultation
                  </Link>
                </motion.div>
              </div>
            </div>
          </aside>

          {/* ================= Posts (centre) ================= */}
          <section aria-label="Articles" className="order-1 min-w-0 lg:order-2">
            {/* mobile/tablet filters */}
            <div className="mb-6 space-y-3 lg:hidden">
              <SearchBox q={q} setQ={search} />
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                {["All", ...categories].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => pickCat(c)}
                    aria-pressed={cat === c}
                    className={cn(
                      "shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                      cat === c
                        ? "border-gold-400/60 bg-gold-400/12 text-gold-600"
                        : "border-foreground/12 bg-nebula text-muted hover:text-foreground"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* list header */}
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                  {filtering ? (cat === "All" ? "Search results" : cat) : "Latest articles"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {list.length} {list.length === 1 ? "article" : "articles"}
                  {term && (
                    <>
                      {" "}for <span className="font-medium text-foreground">&ldquo;{q.trim()}&rdquo;</span>
                    </>
                  )}
                </p>
              </div>
              {filtering && (
                <button
                  type="button"
                  onClick={() => {
                    pickCat("All");
                    setQ("");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-foreground/12 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-gold-400/50 hover:text-gold-600"
                >
                  <X size={12} /> Clear filters
                </button>
              )}
            </div>

            {list.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-foreground/15 py-16 text-center">
                <p className="text-muted">No articles found. Try a different category or search.</p>
              </div>
            ) : (
              <>
                <motion.div layout className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <AnimatePresence mode="popLayout">
                    {shown.map((a) => (
                      <motion.article
                        key={a.slug}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.3 }}
                      >
                        <PostCard a={a} />
                      </motion.article>
                    ))}
                  </AnimatePresence>
                </motion.div>

                {visible < list.length && (
                  <div className="mt-8 flex justify-center">
                    <motion.button
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setVisible((v) => v + PAGE)}
                      className="inline-flex items-center gap-2 rounded-full border border-gold-400/50 bg-white px-6 py-2.5 text-sm font-semibold text-gold-600 transition-colors hover:bg-gold-400/10"
                    >
                      Load more <ChevronDown size={15} />
                    </motion.button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </Container>
    </>
  );
}
