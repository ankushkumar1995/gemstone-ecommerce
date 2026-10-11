"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Clock,
  Calendar,
  ArrowUpRight,
  Share2,
  Check,
  Quote,
  Tag,
  ChevronRight,
  Newspaper,
  Sparkles,
} from "lucide-react";
import type { Article } from "@/types";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function BlogDetailView({
  article,
  related,
  allArticles,
}: {
  article: Article;
  related: Article[];
  allArticles: Article[];
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ title: article.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <Container className="py-8 sm:py-10">
      <Breadcrumb
        items={[{ label: "Blog", href: "/blog" }, { label: article.title }]}
        className="mb-6"
      />

      <div className="grid gap-8 lg:grid-cols-[19rem_1fr] lg:gap-10">
        {/* ---- LEFT: article list sidebar ---- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-foreground/10 bg-nebula p-4">
            <p className="flex items-center gap-2 px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
              <Newspaper size={14} /> All Articles
            </p>
            <nav className="space-y-1">
              {allArticles.map((a) => {
                const active = a.slug === article.slug;
                return (
                  <Link
                    key={a.slug}
                    href={`/blog/${a.slug}`}
                    className={cn(
                      "group flex gap-3 rounded-2xl p-2 transition-colors",
                      active ? "bg-gold-400/10" : "hover:bg-foreground/[0.04]"
                    )}
                  >
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-foreground/10">
                      <Image
                        src={a.image}
                        alt={a.title}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "line-clamp-2 text-sm font-medium leading-snug transition-colors",
                          active
                            ? "text-gold-600"
                            : "text-foreground group-hover:text-gold-600"
                        )}
                      >
                        {a.title}
                      </span>
                      <span className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                        <Calendar size={10} /> {shortDate(a.date)} ·{" "}
                        {a.readMins} min
                      </span>
                    </span>
                  </Link>
                );
              })}
            </nav>

            {/* consultation promo */}
            <div className="mt-3 rounded-2xl bg-gradient-to-br from-royal-500 to-royal-700 p-4 text-white">
              <Sparkles size={18} className="text-gold-200" />
              <p className="mt-2 text-sm font-semibold">Need gem guidance?</p>
              <p className="mt-1 text-xs text-white/75">
                Free consultation with our astrologers.
              </p>
              <Link
                href="/services"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-200 hover:text-white"
              >
                Book now <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </aside>

        {/* ---- RIGHT: article detail ---- */}
        <article className="min-w-0">
          {/* header */}
          <span className="inline-block rounded-full bg-royal-400/12 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-royal-600">
            {article.category}
          </span>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            {article.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            {article.excerpt}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-4 border-b border-foreground/10 pb-6 text-sm text-muted">
            <span className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-royal-500/20 to-gold-400/25 text-xs font-bold text-royal-700">
                {initials(article.author)}
              </span>
              <span>
                <span className="block font-medium text-foreground">
                  {article.author}
                </span>
                <span className="text-xs">{article.authorRole}</span>
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} /> {formatDate(article.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} /> {article.readMins} min read
            </span>
            <button
              onClick={share}
              className="ml-auto flex items-center gap-1.5 rounded-full border border-foreground/15 bg-nebula px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-gold-400/50 hover:text-gold-600"
            >
              {copied ? <Check size={14} /> : <Share2 size={14} />}
              {copied ? "Copied" : "Share"}
            </button>
          </div>

          {/* hero image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="relative mt-6 aspect-[16/9] overflow-hidden rounded-[2rem] border border-foreground/10 shadow-[0_30px_80px_-44px_rgba(36,26,59,0.5)]"
          >
            <Image
              src={article.image}
              alt={article.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 900px"
              className="object-cover"
            />
          </motion.div>

          {/* body */}
          {article.content ? (
            <div
              className="blog-content mt-8"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          ) : (
          <div className="mt-8 space-y-5">
            {article.body.map((block, i) => {
              if (block.type === "h2")
                return (
                  <h2
                    key={i}
                    className="pt-4 text-2xl font-semibold text-foreground"
                  >
                    {block.text}
                  </h2>
                );
              if (block.type === "quote")
                return (
                  <blockquote
                    key={i}
                    className="relative rounded-2xl border border-gold-400/25 bg-gold-400/5 p-6 pl-14 text-lg italic leading-relaxed text-foreground"
                  >
                    <Quote
                      size={22}
                      className="absolute left-5 top-6 text-gold-500"
                    />
                    {block.text}
                  </blockquote>
                );
              if (block.type === "list")
                return (
                  <ul key={i} className="space-y-2.5">
                    {block.items?.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 text-muted"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                );
              return (
                <p key={i} className="text-base leading-relaxed text-muted">
                  {block.text}
                </p>
              );
            })}
          </div>
          )}

          {/* tags */}
          <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-foreground/10 pt-6">
            <Tag size={15} className="text-muted" />
            {article.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-foreground/12 bg-nebula px-3 py-1 text-xs text-foreground"
              >
                {t}
              </span>
            ))}
          </div>

          {/* author card */}
          <div className="mt-6 flex items-start gap-4 rounded-3xl border border-foreground/10 bg-nebula p-6">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-royal-500/20 to-gold-400/25 font-bold text-royal-700">
              {initials(article.author)}
            </span>
            <div>
              <p className="font-semibold text-foreground">{article.author}</p>
              <p className="text-sm text-gold-600">{article.authorRole}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Sharing authentic Vedic wisdom to help you choose and wear
                gemstones with confidence.
              </p>
            </div>
          </div>

          {/* inline CTA */}
          <div className="mt-6 overflow-hidden rounded-[2rem] bg-gradient-to-br from-royal-500 to-royal-700 p-7 text-center text-white sm:p-9">
            <h3 className="text-2xl font-semibold">
              Confused which stone suits you?
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/80">
              Get a free, personalised recommendation from our astrologers.
            </p>
            <Link href="/services" className="mt-5 inline-block">
              <Button variant="gold" size="lg">
                Book a Consultation
              </Button>
            </Link>
          </div>

          {/* related */}
          {related.length > 0 && (
            <div className="mt-14">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-foreground">
                  Related Reads
                </h2>
                <Link
                  href="/blog"
                  className="flex items-center gap-1.5 text-sm font-medium text-gold-600 hover:text-gold-500"
                >
                  All articles <ArrowUpRight size={15} />
                </Link>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
                {related.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/blog/${a.slug}`}
                    className="group overflow-hidden rounded-3xl border border-foreground/10 bg-nebula transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_26px_60px_-28px_rgba(36,26,59,0.45)]"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={a.image}
                        alt={a.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    </div>
                    <div className="p-5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-royal-600">
                        {a.category}
                      </span>
                      <h3 className="mt-2 line-clamp-2 font-semibold leading-snug text-foreground transition-colors group-hover:text-gold-600">
                        {a.title}
                      </h3>
                      <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-600">
                        Read <ArrowUpRight size={14} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
    </Container>
  );
}
