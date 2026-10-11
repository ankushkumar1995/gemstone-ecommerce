"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
}

/**
 * Premium custom dropdown — replaces the native <select> with a themed,
 * animated menu (gold accent, check mark, outside-click + Escape to close).
 */
export function Dropdown<T extends string = string>({
  value,
  options,
  onChange,
  label,
  className,
  align = "right",
}: {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  label?: string;
  className?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full min-w-[11rem] items-center justify-between gap-3 rounded-full border bg-nebula px-4 py-2.5 text-sm font-medium text-foreground transition-colors",
          open ? "border-gold-400/70 ring-2 ring-gold-400/15" : "border-foreground/15 hover:border-foreground/30"
        )}
      >
        <span className="flex items-center gap-1.5">
          {label && <span className="text-muted">{label}:</span>}
          {selected?.label}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-muted transition-transform duration-300",
            open && "rotate-180 text-gold-600"
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "absolute z-50 mt-2 min-w-full overflow-hidden rounded-2xl border border-foreground/10 bg-cosmos p-1.5 shadow-[0_24px_60px_-24px_rgba(36,26,59,0.5)]",
              align === "right" ? "right-0" : "left-0"
            )}
          >
            {options.map((o) => {
              const active = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-6 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors",
                      active
                        ? "bg-gold-400/12 font-medium text-gold-600"
                        : "text-foreground hover:bg-foreground/[0.05]"
                    )}
                  >
                    {o.label}
                    {active && <Check size={15} className="shrink-0 text-gold-600" />}
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
