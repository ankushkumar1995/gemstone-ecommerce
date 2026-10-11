"use client";

/**
 * GlobalSearch — a command-palette style modal that searches products, orders
 * and customers across the admin. Opens from the topbar button or ⌘K / Ctrl+K.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Package, ShoppingCart, User, CornerDownLeft } from "lucide-react";
import type { ApiResponse } from "@/core/http";

interface SearchHit {
  type: "product" | "order" | "customer";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  image?: string;
}

const ICON = { product: Package, order: ShoppingCart, customer: User };

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // focus on open, reset on close
  useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // debounced fetch
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(term)}`);
        const body = (await res.json()) as ApiResponse<SearchHit[]>;
        setHits(body.success ? body.data : []);
        setActive(0);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, open]);

  // keyboard nav
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, hits.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      }
      if (e.key === "Enter" && hits[active]) {
        go(hits[active].href);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hits, active]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm"
          />
          <div className="fixed inset-x-0 top-[12vh] z-[70] mx-auto w-full max-w-xl px-4">
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="overflow-hidden rounded-xl border shadow-2xl"
              style={{ background: "var(--a-surface)", borderColor: "var(--a-border)" }}
            >
              <div className="flex items-center gap-3 border-b px-4" style={{ borderColor: "var(--a-border)" }}>
                <Search size={18} style={{ color: "var(--a-muted)" }} />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search products, orders, customers…"
                  className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--a-faint)]"
                  style={{ color: "var(--a-fg)" }}
                />
                <kbd className="rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: "var(--a-border)", color: "var(--a-faint)" }}>
                  ESC
                </kbd>
              </div>

              <div className="max-h-[55vh] overflow-y-auto p-2">
                {q.trim().length < 2 ? (
                  <p className="px-3 py-6 text-center text-sm" style={{ color: "var(--a-faint)" }}>
                    Type at least 2 characters to search.
                  </p>
                ) : loading && hits.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm" style={{ color: "var(--a-faint)" }}>
                    Searching…
                  </p>
                ) : hits.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm" style={{ color: "var(--a-faint)" }}>
                    No results for &ldquo;{q}&rdquo;.
                  </p>
                ) : (
                  hits.map((h, i) => {
                    const Icon = ICON[h.type];
                    const isActive = i === active;
                    return (
                      <button
                        key={`${h.type}-${h.id}`}
                        onClick={() => go(h.href)}
                        onMouseEnter={() => setActive(i)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
                        style={{ background: isActive ? "var(--a-gold-soft)" : undefined }}
                      >
                        {h.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={h.image} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
                        ) : (
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                            style={{ background: "var(--a-surface-2)", color: "var(--a-gold)" }}
                          >
                            <Icon size={15} />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium" style={{ color: isActive ? "var(--a-gold)" : "var(--a-fg)" }}>
                            {h.title}
                          </span>
                          <span className="block truncate text-xs" style={{ color: "var(--a-faint)" }}>
                            {h.subtitle}
                          </span>
                        </span>
                        {isActive && <CornerDownLeft size={14} style={{ color: "var(--a-muted)" }} />}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
