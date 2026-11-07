"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, SlidersHorizontal, Users } from "lucide-react";
import type { PublicAstrologer } from "@/modules/astrologers/astrologer.types";
import { CATEGORY_OPTIONS, EXPERTISE_OPTIONS, LANGUAGE_OPTIONS } from "@/modules/astrologers/astrologer.types";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { AstrologerCard } from "./astrologer-card";

const SORTS = [
  { v: "recommended", l: "Recommended" },
  { v: "rating", l: "Highest rated" },
  { v: "experience", l: "Most experienced" },
  { v: "sessions", l: "Most consulted" },
  { v: "price_low", l: "Price: low to high" },
  { v: "price_high", l: "Price: high to low" },
];

export function DirectoryView({ items, total, page, pageSize, onlineCount }: { items: PublicAstrologer[]; total: number; page: number; pageSize: number; onlineCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, start] = useTransition();
  const pages = Math.max(1, Math.ceil(total / pageSize));

  /** Filters live in the URL so a filtered list can be shared or bookmarked. */
  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v); else p.delete(k);
    if (k !== "page") p.delete("page");
    start(() => router.push(`${pathname}?${p.toString()}`, { scroll: k === "page" }));
  };
  const select = (k: string, label: string, options: readonly string[]) => (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select value={params.get(k) ?? ""} onChange={(e) => setParam(k, e.target.value || null)} className="w-full rounded-full border border-foreground/15 bg-white/80 px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold-400">
        <option value="">{label}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );

  return (
    <div className="pb-16">
      <Container className="pt-6"><Breadcrumb items={[{ label: "Astrologers" }]} /></Container>
      <Container className="pt-8">
        <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">Talk to <span className="text-gradient-gold">verified astrologers</span></h1>
        <p className="mt-2 max-w-2xl text-muted">Chat or call experienced Vedic, KP, Tarot and Numerology experts. Pay per minute, end anytime.</p>
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-700"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />{onlineCount} online now</p>

        <form className="mt-6 flex flex-col gap-3 lg:flex-row" onSubmit={(e) => { e.preventDefault(); setParam("q", q.trim() || null); }} role="search">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, skill or topic" aria-label="Search astrologers" className="w-full rounded-full border border-foreground/15 bg-white/80 py-2.5 pl-10 pr-4 text-sm text-foreground outline-none focus:border-gold-400" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex">
            {select("expertise", "Any skill", EXPERTISE_OPTIONS)}
            {select("category", "Any topic", CATEGORY_OPTIONS)}
            {select("language", "Any language", LANGUAGE_OPTIONS)}
            <label className="block"><span className="sr-only">Sort</span>
              <select value={params.get("sort") ?? "recommended"} onChange={(e) => setParam("sort", e.target.value === "recommended" ? null : e.target.value)} className="w-full rounded-full border border-foreground/15 bg-white/80 px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold-400">
                {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </label>
          </div>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 text-foreground"><input type="checkbox" className="h-4 w-4 accent-[#7a45f5]" checked={params.get("online") === "1"} onChange={(e) => setParam("online", e.target.checked ? "1" : null)} />Online now only</label>
          {["chat", "call", "video"].map((c) => (
            <button key={c} type="button" onClick={() => setParam("channel", params.get("channel") === c ? null : c)} aria-pressed={params.get("channel") === c}
              className={`rounded-full border px-3 py-1 capitalize ${params.get("channel") === c ? "border-royal-500 bg-royal-500/10 text-royal-700" : "border-foreground/15 text-muted"}`}>{c}</button>
          ))}
          <span className="ml-auto inline-flex items-center gap-1.5 text-muted"><SlidersHorizontal size={14} />{total} astrologer{total === 1 ? "" : "s"}</span>
        </div>

        <div className={`mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${pending ? "opacity-60 transition-opacity" : ""}`}>
          {items.map((a) => <AstrologerCard key={a.id} a={a} />)}
        </div>
        {items.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-2 rounded-3xl border border-dashed border-foreground/15 p-10 text-center">
            <Users className="text-muted" />
            <p className="font-medium text-foreground">No astrologers match these filters</p>
            <button type="button" className="text-sm font-semibold text-gold-600" onClick={() => start(() => router.push(pathname))}>Clear filters</button>
          </div>
        )}
        {pages > 1 && (
          <nav className="mt-8 flex justify-center gap-2" aria-label="Pages">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <button key={p} type="button" onClick={() => setParam("page", p === 1 ? null : String(p))} aria-current={p === page ? "page" : undefined}
                className={`h-9 min-w-9 rounded-full px-3 text-sm font-medium ${p === page ? "bg-gradient-to-r from-gold-400 to-gold-500 text-white" : "border border-foreground/15 text-foreground"}`}>{p}</button>
            ))}
          </nav>
        )}
      </Container>
    </div>
  );
}
