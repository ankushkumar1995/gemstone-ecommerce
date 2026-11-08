"use client";

/**
 * SelectField — premium dropdown for storefront forms. Looks like the text
 * inputs next to it, animates open, and works with keyboard and screen
 * readers: Enter/Space/Arrow opens, arrows move, Enter picks, Escape/Tab or
 * an outside click closes.
 *
 * Pair with a visible label whose id is `${id}-label`.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const fieldBase =
  "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:ring-2";
export const fieldOk = "border-foreground/12 focus:border-gold-400/70 focus:ring-gold-400/20";
export const fieldBad = "border-rose-400/70 focus:border-rose-400 focus:ring-rose-400/15";

export function SelectField({
  id,
  value,
  options,
  onChange,
  invalid,
  describedBy,
  placeholder = "Select",
}: {
  id: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);
  const listId = `${id}-list`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const openList = () => {
    setHi(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    btn.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === "Tab") setOpen(false);
    else if (e.key === "ArrowDown") { e.preventDefault(); setHi((i) => (i + 1) % options.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((i) => (i - 1 + options.length) % options.length); }
    else if (e.key === "Home") { e.preventDefault(); setHi(0); }
    else if (e.key === "End") { e.preventDefault(); setHi(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(options[hi].value); }
  };

  return (
    <div ref={wrap} className="relative">
      <button
        ref={btn}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${id}-label ${id}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-activedescendant={open ? `${id}-opt-${hi}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey}
        className={cn(
          fieldBase,
          "flex items-center justify-between gap-2 text-left",
          invalid ? fieldBad : fieldOk,
          open && !invalid && "border-gold-400/70 ring-2 ring-gold-400/20",
        )}
      >
        <span className={cn("truncate", !selected && "text-muted/70")}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={16} className={cn("shrink-0 text-muted transition-transform duration-200", open && "rotate-180 text-gold-600")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={listId}
            role="listbox"
            aria-labelledby={`${id}-label`}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-60 origin-top overflow-y-auto rounded-xl border border-foreground/10 bg-white p-1 shadow-[0_18px_40px_-16px_rgba(40,20,90,0.35)]"
          >
            {options.map((o, i) => {
              const sel = o.value === value;
              return (
                <li
                  key={o.value}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={sel}
                  onMouseEnter={() => setHi(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o.value)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                    sel ? "font-semibold text-gold-600" : "text-foreground",
                    i === hi ? "bg-gold-400/12" : "",
                  )}
                >
                  {o.label}
                  {sel && <Check size={14} className="text-gold-600" />}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
