"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { useCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

/**
 * Compact currency switcher for the navbar. Lets foreign shoppers display
 * prices in their own currency; selection persists across the site.
 */
export function CurrencySelector({ className }: { className?: string }) {
  const { currency, currencies, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Select currency"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border border-foreground/12 bg-nebula px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-gold-400/50"
      >
        <span className="text-base leading-none">{currency.flag}</span>
        <span>{currency.code}</span>
        <ChevronDown
          size={14}
          className={cn("text-muted transition-transform duration-300", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-foreground/10 bg-cosmos p-1.5 shadow-[0_24px_60px_-24px_rgba(36,26,59,0.5)]"
          >
            {currencies.map((c) => {
              const active = c.code === currency.code;
              return (
                <li key={c.code}>
                  <button
                    onClick={() => {
                      setCurrency(c.code);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                      active
                        ? "bg-gold-400/10 text-gold-600"
                        : "text-foreground hover:bg-foreground/[0.04]"
                    )}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="flex-1">
                      <span className="font-medium">{c.code}</span>
                      <span className="ml-1.5 text-xs text-muted">{c.label}</span>
                    </span>
                    <span className="text-muted">{c.symbol}</span>
                    {active && <Check size={15} className="text-gold-600" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
