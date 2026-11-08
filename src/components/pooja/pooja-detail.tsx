"use client";

/**
 * /pooja/[slug] — pooja detail with gallery, info, content sections,
 * packages (picking one updates the booking form), FAQs, the booking form
 * and related poojas. Optional sections hide when the admin left them empty.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowRight, BadgeCheck, CalendarDays, Check, ChevronDown, Clock, Flame, Gift, MapPin, Play, ScrollText, ShieldCheck, Sparkles, Star, Users, Video,
} from "lucide-react";
import type { PublicPooja, PublicPoojaCategory } from "@/modules/poojas/pooja.types";
import { useCurrency } from "@/lib/currency";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ButtonLink } from "@/components/ui/button";
import { PoojaCard, PoojaIcon, fmtDuration, nextLabel, offPct, poojaPlace, ritualOf, type CardPooja, type NextSlot } from "@/components/pooja/pooja-ui";
import { HavanInfo, TierLine } from "@/components/pooja/havan-info";
import { PoojaBookingForm } from "@/components/pooja/pooja-booking-form";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function PoojaDetail({ pooja, category, next, related, categories }: {
  pooja: PublicPooja; category: PublicPoojaCategory | null; next: NextSlot; related: CardPooja[]; categories: PublicPoojaCategory[];
}) {
  const { format } = useCurrency();
  const reduce = useReducedMotion();
  const images = [pooja.coverImage, ...pooja.gallery].filter(Boolean);
  const [img, setImg] = useState(0);
  const defaultPkg = pooja.packages.find((p) => p.popular) ?? pooja.packages[0];
  const [packageId, setPackageId] = useState(defaultPkg.id);
  const off = offPct(pooja.priceFrom, pooja.mrpFrom);
  const place = poojaPlace(pooja);
  const R = ritualOf(pooja);
  const isHavan = pooja.type === "havan";
  const vid = pooja.videoUrl ? youtubeId(pooja.videoUrl) : null;
  const catByKey = new Map(categories.map((c) => [c.key, c]));

  // "Book" links land on #book; the form shifts a little while dates load.
  useEffect(() => {
    if (window.location.hash !== "#book") return;
    const go = () => document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
    const a = window.setTimeout(go, 150), b = window.setTimeout(go, 700);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, []);

  const pickPackage = (id: string) => {
    setPackageId(id);
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const facts = [
    pooja.deity && { icon: Flame, label: "Deity", value: pooja.deity },
    place && { icon: MapPin, label: "Place", value: place },
    { icon: Clock, label: "Duration", value: fmtDuration(pooja.durationMin) },
    { icon: Users, label: "Pandits", value: `${pooja.panditCount}` },
    pooja.mantraCount > 0 && { icon: ScrollText, label: "Mantra jaap", value: pooja.mantraCount.toLocaleString("en-IN") },
  ].filter(Boolean) as { icon: typeof Flame; label: string; value: string }[];

  return (
    <div className="pb-10">
      <Container className="pt-5">
        <Breadcrumb
          items={[
            { label: isHavan ? "Havan & Yagya" : "Pooja", href: R.base },
            ...(category ? [{ label: category.name, href: `${R.base}?category=${category.slug}` }] : []),
            { label: pooja.title },
          ]}
          className="mb-4"
        />

        {/* ---------------- hero ---------------- */}
        <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
          {/* gallery */}
          <motion.div initial={reduce ? false : { opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease }}>
            <div className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-foreground/10 bg-gradient-to-br from-gold-400/25 to-royal-500/20 shadow-[0_26px_60px_-34px_rgba(36,26,59,0.55)]">
              <AnimatePresence mode="wait">
                {images.length > 0 ? (
                  <motion.div key={images[img]} className="absolute inset-0" initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                    <Image src={images[img]} alt={img === 0 ? pooja.title : `${pooja.title}, photo ${img + 1}`} fill priority={img === 0} sizes="(max-width: 1024px) 100vw, 52vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                  </motion.div>
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-gold-600"><Flame size={64} strokeWidth={1.2} /></span>
                )}
              </AnimatePresence>
              <div className="absolute left-3 top-3 flex gap-2">
                {category && <span className="flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-gold-700 shadow-sm backdrop-blur"><PoojaIcon name={category.icon} size={12} /> {category.name}</span>}
                {pooja.featured && <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-gold-400 to-gold-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm"><Star size={11} className="fill-white" /> Featured</span>}
              </div>
            </div>
            {images.length > 1 && (
              <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label={`${R.noun} photos`}>
                {images.map((src, i) => (
                  <button key={src + i} type="button" role="tab" aria-selected={i === img} aria-label={`Photo ${i + 1}`} onClick={() => setImg(i)}
                    className={cn("relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all", i === img ? "border-gold-500 shadow-md" : "border-transparent opacity-70 hover:opacity-100")}>
                    <Image src={src} alt="" fill sizes="80px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* info */}
          <motion.div initial={reduce ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease }} className="flex flex-col">
            <h1 className="font-display text-[1.7rem] font-semibold leading-tight text-foreground sm:text-[2rem]">{pooja.title}</h1>
            {pooja.subtitle && <p className="mt-1 text-[15px] font-medium text-gold-600">{pooja.subtitle}</p>}
            {pooja.shortDescription && <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{pooja.shortDescription}</p>}

            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {facts.map((f) => (
                <div key={f.label} className="flex items-start gap-2 rounded-xl border border-foreground/8 bg-white px-3 py-2">
                  <f.icon size={15} className="mt-0.5 shrink-0 text-gold-500" />
                  <div className="min-w-0">
                    <dt className="text-[10.5px] uppercase tracking-wider text-muted">{f.label}</dt>
                    <dd className="truncate text-[13px] font-semibold text-foreground" title={f.value}>{f.value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-gold-400/30 bg-gradient-to-r from-gold-400/[0.10] via-white to-white p-4">
              <div>
                <p className="text-[11px] text-muted">Starting from</p>
                <p className="flex items-baseline gap-2">
                  <span className="text-[1.75rem] font-bold leading-none text-foreground">{format(pooja.priceFrom)}</span>
                  {pooja.mrpFrom && <span className="text-sm text-muted line-through">{format(pooja.mrpFrom)}</span>}
                  {off > 0 && <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-600">{off}% off</span>}
                </p>
                {next && <p className="mt-1.5 flex items-center gap-1 text-[12.5px] font-medium text-emerald-700"><CalendarDays size={13} /> {nextLabel(next)}</p>}
              </div>
              <ButtonLink href="#book" variant="gold" size="lg" className="gap-1.5 px-7">
                Book This {R.noun} <ArrowRight size={16} />
              </ButtonLink>
            </div>

            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-muted">
              <li className="flex items-center gap-1.5"><BadgeCheck size={14} className="text-gold-500" /> Verified pandits</li>
              <li className="flex items-center gap-1.5"><Video size={14} className="text-gold-500" /> {isHavan ? (pooja.havan.liveUrl ? "Live darshan" : "Havan video shared") : "Pooja video shared"}</li>
              {pooja.addOns.some((a) => a.kind === "prasad") && <li className="flex items-center gap-1.5"><Gift size={14} className="text-gold-500" /> Prasad at home</li>}
              <li className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-gold-500" /> No payment to request</li>
            </ul>
          </motion.div>
        </div>

        {/* ---------------- havan details (havan only) ---------------- */}
        {isHavan && <HavanInfo pooja={pooja} />}

        {/* ---------------- content ---------------- */}
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {pooja.description.trim() && (
            <Panel title={`About this ${R.lower}`} className="lg:col-span-2">
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-muted">{pooja.description}</p>
            </Panel>
          )}
          {pooja.benefits.length > 0 && (
            <Panel title="Benefits" icon={Sparkles}>
              <List items={pooja.benefits} />
            </Panel>
          )}
          {pooja.includes.length > 0 && (
            <Panel title="What you get" icon={Gift}>
              <List items={pooja.includes} />
            </Panel>
          )}
          {pooja.vidhi.length > 0 && (
            <Panel title={`${R.noun} vidhi`} icon={ScrollText} className={cn(!vid && "lg:col-span-2")}>
              <ol className="relative space-y-3 border-l border-gold-400/40 pl-5">
                {pooja.vidhi.map((v, i) => (
                  <li key={i} className="relative text-[13.5px] leading-snug text-foreground">
                    <span className="absolute -left-[1.85rem] top-0 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-[10px] font-bold text-white ring-4 ring-white">{i + 1}</span>
                    {v}
                  </li>
                ))}
              </ol>
            </Panel>
          )}
          {pooja.videoUrl && <VideoPanel url={pooja.videoUrl} id={vid} title={pooja.title} noun={R.lower} />}
        </div>

        {/* ---------------- packages ---------------- */}
        <section aria-labelledby="pkg-title" className="mt-8">
          <h2 id="pkg-title" className="text-lg font-semibold text-foreground">Choose your package</h2>
          <div className="mt-3 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {pooja.packages.map((p) => {
              const on = p.id === packageId;
              const pOff = offPct(p.price, p.mrp);
              return (
                <motion.article key={p.id} whileHover={reduce ? undefined : { y: -4 }} transition={{ type: "spring", stiffness: 320, damping: 24 }}
                  className={cn("relative flex flex-col rounded-2xl border bg-white p-4 transition-[border-color,box-shadow]", on ? "border-gold-400 shadow-[0_22px_50px_-30px_rgba(201,148,42,0.8)]" : "border-foreground/10 hover:border-gold-400/50")}>
                  {p.popular && <span className="absolute -top-2.5 left-4 rounded-full bg-gradient-to-r from-gold-400 to-gold-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">Most chosen</span>}
                  <h3 className="text-[15px] font-semibold text-foreground">{p.name}</h3>
                  <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted"><Users size={12} /> Up to {p.members} name{p.members > 1 ? "s" : ""}</p>
                  {isHavan && <TierLine pkg={p} />}
                  <p className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-foreground">{format(p.price)}</span>
                    {p.mrp && p.mrp > p.price && <span className="text-[12px] text-muted line-through">{format(p.mrp)}</span>}
                    {pOff > 0 && <span className="text-[11px] font-bold text-rose-600">{pOff}% off</span>}
                  </p>
                  {p.description && <p className="mt-1.5 text-[12.5px] leading-snug text-muted">{p.description}</p>}
                  {p.perks.length > 0 && (
                    <ul className="mt-2.5 space-y-1">
                      {p.perks.map((x) => <li key={x} className="flex items-start gap-1.5 text-[12.5px] text-foreground"><Check size={13} className="mt-0.5 shrink-0 text-emerald-600" /> {x}</li>)}
                    </ul>
                  )}
                  <div className="mt-auto pt-4">
                    <button type="button" onClick={() => pickPackage(p.id)} aria-pressed={on}
                      className={cn("inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 active:scale-[0.98]",
                        on ? "bg-gradient-to-r from-gold-400 to-gold-500 text-white shadow-[0_10px_22px_-12px_rgba(201,148,42,0.9)]" : "border border-gold-400/60 text-gold-700 hover:bg-gold-400/10")}>
                      {on ? <><Check size={14} /> Selected, continue</> : <>Select package <ArrowRight size={14} /></>}
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </section>

        {/* ---------------- booking ---------------- */}
        <div className="mt-8">
          <PoojaBookingForm pooja={pooja} packageId={packageId} onPackageChange={setPackageId} />
        </div>

        {/* ---------------- FAQs ---------------- */}
        {pooja.faqs.length > 0 && (
          <section aria-labelledby="faq-title" className="mt-8">
            <h2 id="faq-title" className="text-lg font-semibold text-foreground">Frequently asked questions</h2>
            <div className="mt-3 divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/10 bg-white">
              {pooja.faqs.map((f, i) => <Faq key={i} q={f.q} a={f.a} />)}
            </div>
          </section>
        )}

        {/* ---------------- related ---------------- */}
        {related.length > 0 && (
          <section aria-labelledby="rel-title" className="mt-8">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-600">You may also like</p>
                <h2 id="rel-title" className="text-lg font-semibold text-foreground">{category && related.every((r) => r.category === category.key) ? `More ${category.name} poojas` : "Related poojas"}</h2>
              </div>
              <Link href={R.base} className="inline-flex items-center gap-1 text-sm font-semibold text-gold-600 hover:text-gold-500">View all <ArrowRight size={14} /></Link>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {related.map((r) => { const c = catByKey.get(r.category); return <PoojaCard key={r.id} p={r} categoryName={c?.name} categoryIcon={c?.icon} />; })}
            </div>
          </section>
        )}
      </Container>
    </div>
  );
}

function Panel({ title, icon: I, className, children }: { title: string; icon?: typeof Flame; className?: string; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.45, ease }}
      className={cn("rounded-2xl border border-foreground/10 bg-white p-5 shadow-[0_14px_36px_-30px_rgba(36,26,59,0.45)]", className)}>
      <h2 className="mb-3 flex items-center gap-2 text-[16px] font-semibold text-foreground">
        {I && <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-gold-400/20 to-royal-500/15 text-gold-600"><I size={16} /></span>}
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((x) => (
        <li key={x} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-foreground">
          <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><Check size={12} strokeWidth={2.6} /></span>
          {x}
        </li>
      ))}
    </ul>
  );
}

/** YouTube loads only after a click (no third-party script on page load). */
function VideoPanel({ url, id, title, noun = "pooja" }: { url: string; id: string | null; title: string; noun?: string }) {
  const [play, setPlay] = useState(false);
  return (
    <Panel title={`Watch the ${noun}`} icon={Video}>
      {id ? (
        <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
          {play ? (
            <iframe className="absolute inset-0 h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={`${title} video`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          ) : (
            <button type="button" onClick={() => setPlay(true)} aria-label="Play video" className="group absolute inset-0">
              <Image src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" fill sizes="(max-width: 1024px) 100vw, 45vw" className="object-cover opacity-90 transition-opacity group-hover:opacity-100" unoptimized />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-gold-600 shadow-xl transition-transform group-hover:scale-110"><Play size={24} className="ml-1 fill-gold-500" /></span>
              </span>
            </button>
          )}
        </div>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-600 hover:text-gold-500"><Play size={15} /> Watch the video</a>
      )}
    </Panel>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-[14px] font-medium text-foreground transition-colors hover:bg-gold-400/[0.04]">
        {q}
        <ChevronDown size={16} className={cn("shrink-0 text-muted transition-transform duration-200", open && "rotate-180 text-gold-600")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <p className="whitespace-pre-line px-4 pb-4 text-[13.5px] leading-relaxed text-muted">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
