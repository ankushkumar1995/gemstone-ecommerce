"use client";

/** /pooja and /havan: all bookable items of one type with category chips, search and sort. */

import { useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Search, LayoutGrid, Flame, PhoneCall, X, ShieldCheck, Video, Package } from "lucide-react";
import type { PublicPoojaCategory, RitualType } from "@/modules/poojas/pooja.types";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ButtonLink } from "@/components/ui/button";
import { PoojaCard, poojaIcon, type CardPooja } from "@/components/pooja/pooja-ui";
import { cn } from "@/lib/utils";

type Sort = "recommended" | "price_low" | "price_high" | "soonest";
const SORTS: { value: Sort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "soonest", label: "Earliest date" },
  { value: "price_low", label: "Price: low to high" },
  { value: "price_high", label: "Price: high to low" },
];

/** Page copy per type. The pooja copy is exactly what /pooja showed before havan existed. */
const COPY = {
  pooja: {
    crumb: "Pooja", eyebrow: "Online Pooja", title: "Book a Pooja, ", accent: "Performed in Your Name",
    text: "Vedic poojas at sacred temples and with our learned pandits. Share your sankalp, watch the pooja video and receive prasad at home.",
    video: "Pooja video shared", gift: "Prasad delivered", explore: "Explore Poojas", image: "/images/Pooja-Rituals.png",
    empty: "Poojas are coming soon", emptyText: "We are preparing our pooja calendar. Talk to an astrologer to know which pooja is right for you.",
    search: "Search pooja, deity, temple…", one: "pooja", many: "poojas",
  },
  havan: {
    crumb: "Havan & Yagya", eyebrow: "Online Havan & Yagya", title: "Sacred Havan & Yagya, ", accent: "Offered in Your Name",
    text: "Vedic havan, yagya and anushthan with mantra jaap and ahutis by learned pandits. Ekal or samuhik, with daily updates, live darshan and havan bhasma at home.",
    video: "Live / recorded havan", gift: "Bhasma & raksha sutra", explore: "Explore Havans", image: "/images/Havan-Ritual-Banner.png",
    empty: "Havans are coming soon", emptyText: "We are preparing our havan and yagya calendar. Talk to an astrologer to know which havan is right for you.",
    search: "Search havan, yagya, mantra…", one: "havan", many: "havans",
  },
} as const;

export function PoojaListing({ poojas, categories, initialCategory, type = "pooja" }: { poojas: CardPooja[]; categories: PublicPoojaCategory[]; initialCategory: string | null; type?: RitualType }) {
  const C = COPY[type];
  const reduce = useReducedMotion();
  const [cat, setCat] = useState<string | null>(initialCategory);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recommended");
  const catByKey = useMemo(() => new Map(categories.map((c) => [c.key, c])), [categories]);

  const pick = (key: string | null) => {
    setCat(key);
    const slug = key ? catByKey.get(key)?.slug : null;
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("category", slug); else url.searchParams.delete("category");
    window.history.replaceState(null, "", url.pathname + url.search);
  };

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = poojas.filter((p) => (!cat || p.category === cat) && (!term || [p.title, p.subtitle, p.deity, p.location.city, p.location.place, ...p.tags].join(" ").toLowerCase().includes(term)));
    if (sort === "price_low") out = [...out].sort((a, b) => a.priceFrom - b.priceFrom);
    if (sort === "price_high") out = [...out].sort((a, b) => b.priceFrom - a.priceFrom);
    if (sort === "soonest") out = [...out].sort((a, b) => (a.next ? `${a.next.date}${a.next.time}` : "~").localeCompare(b.next ? `${b.next.date}${b.next.time}` : "~"));
    return out;
  }, [poojas, cat, q, sort]);

  return (
    <div className="pb-10">
      {/* hero */}
      <section className="relative isolate overflow-hidden border-b border-gold-400/20 bg-[#fbf3ec] lg:min-h-[26rem]">
        {/* banner art: clear area on the left for text, pooja thali on the right */}
        <motion.div
          aria-hidden
          className="absolute inset-0 -z-10"
          initial={reduce ? false : { scale: 1.06, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <Image src={C.image} alt="" fill priority sizes="100vw" className="object-cover object-[80%_center] lg:object-right" />
        </motion.div>
        {/* readability: strong fade on small screens, left-side fade on desktop */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-white/65 lg:hidden" />
        <div aria-hidden className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-white/80 via-white/45 to-transparent lg:block" />
        <Container className="relative py-6 sm:py-8 lg:py-10">
          <Breadcrumb items={[{ label: C.crumb }]} />
          <div className="mt-3 max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-600">{C.eyebrow}</p>
            <h1 className="mt-1 font-display text-[1.75rem] font-semibold leading-tight text-foreground sm:text-[2.1rem]">
              {C.title}<span className="text-gradient-gold">{C.accent}</span>
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-foreground/75">
              {C.text}
            </p>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2 text-[13px] font-medium text-foreground">
            {[
              { icon: ShieldCheck, label: "Verified pandits" },
              { icon: Video, label: C.video },
              { icon: Package, label: C.gift },
            ].map((t) => (
              <li key={t.label} className="flex items-center gap-1.5 rounded-full border border-white/80 bg-white/75 px-3 py-1.5 shadow-sm backdrop-blur-md">
                <t.icon size={14} className="text-gold-500" /> {t.label}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href="#pooja-list" variant="gold" size="md" className="gap-1.5">{C.explore}</ButtonLink>
            <ButtonLink href="/consultation" variant="outline" size="md" className="gap-1.5 bg-white/70 backdrop-blur-md"><PhoneCall size={15} /> Ask an Astrologer</ButtonLink>
          </div>
        </Container>
      </section>

      <Container id="pooja-list" className="scroll-mt-24 pt-5">
        {poojas.length === 0 ? (
          <div className="mx-auto max-w-md py-16 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-400/12 text-gold-600"><Flame size={30} /></span>
            <h2 className="mt-4 text-xl font-semibold text-foreground">{C.empty}</h2>
            <p className="mt-1.5 text-sm text-muted">{C.emptyText}</p>
            <ButtonLink href="/#free-consultation" variant="gold" size="md" className="mt-5 gap-1.5"><PhoneCall size={15} /> Talk to an Astrologer</ButtonLink>
          </div>
        ) : (
          <>
            {/* toolbar */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div role="toolbar" aria-label={`Filter ${C.many} by category`} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-wrap lg:px-0">
                <Chip active={!cat} onClick={() => pick(null)} icon={LayoutGrid} label="All" count={poojas.length} />
                {categories.map((c) => (
                  <Chip key={c.key} active={cat === c.key} onClick={() => pick(c.key)} icon={poojaIcon(c.icon)} label={c.name} count={c.count} />
                ))}
              </div>
              <div className="flex shrink-0 gap-2">
                <label className="relative flex-1 lg:w-64 lg:flex-none">
                  <span className="sr-only">Search {C.many}</span>
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 60))} placeholder={C.search} className="h-10 w-full rounded-full border border-foreground/12 bg-white pl-9 pr-8 text-sm outline-none transition-colors focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20" />
                  {q && <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"><X size={14} /></button>}
                </label>
                <label className="relative">
                  <span className="sr-only">Sort {C.many}</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-10 cursor-pointer appearance-none rounded-full border border-foreground/12 bg-white pl-4 pr-9 text-sm font-medium outline-none transition-colors focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20">
                    {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <span aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-muted">▼</span>
                </label>
              </div>
            </div>

            <p className="mt-3 text-[13px] text-muted" aria-live="polite">
              {list.length} {list.length === 1 ? C.one : C.many}{cat ? ` in ${catByKey.get(cat)?.name}` : ""}{q.trim() ? ` for “${q.trim()}”` : ""}
            </p>

            {list.length === 0 ? (
              <div className="py-14 text-center">
                <p className="text-sm text-muted">No {C.one} matches your search.</p>
                <button type="button" onClick={() => { setQ(""); pick(null); }} className="mt-2 text-sm font-semibold text-gold-600 hover:text-gold-500">Clear filters</button>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.ul
                  key={`${cat ?? "all"}-${sort}`}
                  initial={reduce ? false : "hidden"}
                  animate="show"
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
                  className="mt-3 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                >
                  {list.map((p, i) => {
                    const c = catByKey.get(p.category);
                    return (
                      <motion.li key={p.id} variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }}>
                        <PoojaCard p={p} categoryName={c?.name} categoryIcon={c?.icon} priority={i < 4} />
                      </motion.li>
                    );
                  })}
                </motion.ul>
              </AnimatePresence>
            )}
          </>
        )}
      </Container>
    </div>
  );
}

function Chip({ active, onClick, icon: I, label, count }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ size?: number }>; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60",
        active ? "border-transparent bg-gradient-to-r from-gold-400 to-gold-500 text-white shadow-[0_8px_20px_-10px_rgba(201,148,42,0.8)]" : "border-foreground/10 bg-white text-foreground hover:border-gold-400/50",
      )}
    >
      <I size={14} /> {label}
      <span className={cn("rounded-full px-1.5 text-[10.5px] tabular-nums", active ? "bg-white/25" : "bg-foreground/5 text-muted")}>{count}</span>
    </button>
  );
}
