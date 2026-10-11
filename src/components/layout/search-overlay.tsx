"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, TrendingUp } from "lucide-react";
import { getAllProducts } from "@/data/products";
import { useCurrency } from "@/lib/currency";

const POPULAR = ["Ruby", "Blue Sapphire", "Emerald", "Pearl", "Yellow Sapphire"];

/**
 * Full-width search overlay. Filters the catalogue live by name, stone,
 * planet or zodiac. Opens from the navbar search icon.
 */
export function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const all = useMemo(() => getAllProducts(), []);
  const { format } = useCurrency();

  // focus input + lock scroll + close on Escape
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // reset query when closed
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return all
      .filter((p) => {
        const haystack = [
          p.name,
          p.attributes.stone,
          p.attributes.planet,
          ...p.zodiac,
          p.category,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, 6);
  }, [q, all]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 top-0 z-50 bg-cosmos shadow-xl"
          >
            <div className="mx-auto w-full max-w-3xl px-5 py-5 sm:px-8">
              {/* input row */}
              <div className="flex items-center gap-3 rounded-2xl border border-foreground/15 bg-nebula px-4 py-3">
                <Search size={20} className="shrink-0 text-gold-500" />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search gemstones, planets, zodiac…"
                  className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted"
                />
                <button
                  onClick={onClose}
                  aria-label="Close search"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-foreground/10 hover:text-foreground"
                >
                  <X size={18} />
                </button>
              </div>

              {/* body */}
              <div className="mt-5 max-h-[60vh] overflow-y-auto">
                {q.trim() === "" ? (
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                      <TrendingUp size={13} /> Popular searches
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {POPULAR.map((term) => (
                        <button
                          key={term}
                          onClick={() => setQ(term)}
                          className="rounded-full border border-foreground/12 bg-nebula px-3.5 py-1.5 text-sm text-foreground transition-colors hover:border-gold-400/50 hover:text-gold-600"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : results.length === 0 ? (
                  <p className="py-10 text-center text-muted">
                    No gemstones found for{" "}
                    <span className="font-medium text-foreground">“{q}”</span>
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {results.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/product/${p.slug}`}
                          onClick={onClose}
                          className="flex items-center gap-4 rounded-2xl p-2 transition-colors hover:bg-foreground/[0.04]"
                        >
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-foreground/10">
                            <Image
                              src={p.image}
                              alt={p.name}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm font-medium text-foreground">
                              {p.name}
                            </p>
                            <p className="text-xs text-muted">
                              {p.attributes.planet} • {p.attributes.stone}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-gold-600">
                            {format(p.price)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
