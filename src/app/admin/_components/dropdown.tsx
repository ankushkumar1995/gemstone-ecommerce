"use client";

/**
 * AdminDropdown — a premium, animated custom dropdown (replaces native
 * <select> across the admin). Gold accent, check mark, outside-click + Escape
 * to close. Used for DataTable filters, page-size, form selects, etc.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
}

export function AdminDropdown({
  value,
  options,
  onChange,
  placeholder = "Select",
  label,
  size = "md",
  align = "left",
  direction = "down",
  active,
  className,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** optional prefix label shown in the trigger, e.g. "Category" */
  label?: string;
  size?: "sm" | "md";
  align?: "left" | "right";
  /** open the menu upward (for triggers near the bottom of the page) */
  direction?: "down" | "up";
  /** force the "active/selected" gold styling (e.g. a set filter) */
  active?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);
  const isActive = active ?? Boolean(value);

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

  const h = size === "sm" ? "h-8 text-xs" : "h-9 text-sm";

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border bg-transparent px-3 font-medium transition-colors",
          h
        )}
        style={{
          borderColor: isActive ? "var(--a-gold)" : open ? "var(--a-gold)" : "var(--a-border)",
          color: isActive ? "var(--a-gold)" : "var(--a-fg)",
        }}
      >
        <span className="truncate">
          {label && <span style={{ color: "var(--a-faint)" }}>{label}: </span>}
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={size === "sm" ? 13 : 15}
          className={cn("shrink-0 transition-transform duration-200", open && "rotate-180")}
          style={{ color: "var(--a-muted)" }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: direction === "up" ? -6 : 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: direction === "up" ? -6 : 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute z-40 max-h-64 min-w-[11rem] overflow-y-auto rounded-xl border p-1.5 shadow-xl",
              align === "right" ? "right-0" : "left-0",
              direction === "up" ? "bottom-full mb-1.5" : "top-full mt-1.5"
            )}
            style={{ background: "var(--a-surface)", borderColor: "var(--a-border)" }}
          >
            {options.map((o) => {
              const sel = o.value === value;
              return (
                <li key={o.value || "__all"}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={sel}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-4 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      sel ? "font-medium" : "hover:bg-black/[0.04]"
                    )}
                    style={{
                      background: sel ? "var(--a-gold-soft)" : undefined,
                      color: sel ? "var(--a-gold)" : "var(--a-fg)",
                    }}
                  >
                    {o.label}
                    {sel && <Check size={14} />}
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
