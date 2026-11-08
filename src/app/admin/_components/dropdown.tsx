"use client";

/**
 * AdminDropdown — a premium, animated custom dropdown (replaces native
 * <select> across the admin). Gold accent, check mark, outside-click + Escape
 * to close. Used for DataTable filters, page-size, form selects, etc.
 */

import { Children, Fragment, isValidElement, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
  /** optional leading icon, shown in the list and in the trigger */
  icon?: React.ReactNode;
  /** optional small muted text on the right, e.g. a count */
  meta?: string;
  disabled?: boolean;
}

/* ------------------------------------------------------------------ */
/* AdminSelectPro: drop-in for AdminSelect (same <option> children and */
/* event-style onChange) that renders the premium dropdown.           */
/* ------------------------------------------------------------------ */
function nodeText(n: React.ReactNode): string {
  if (n === null || n === undefined || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(nodeText).join("");
  if (isValidElement(n)) return nodeText((n.props as { children?: React.ReactNode }).children);
  return "";
}

function collectOptions(children: React.ReactNode, out: DropdownOption[] = []): DropdownOption[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const p = child.props as { value?: string | number; disabled?: boolean; children?: React.ReactNode };
    if (child.type === "option") {
      const label = nodeText(p.children).replace(/\s+/g, " ").trim();
      out.push({ value: p.value !== undefined ? String(p.value) : label, label, disabled: p.disabled });
    } else if (child.type === "optgroup" || child.type === Fragment) {
      collectOptions(p.children, out);
    }
  });
  return out;
}

export function AdminSelectPro({
  value,
  onChange,
  children,
  className,
  disabled,
  placeholder,
  "aria-label": ariaLabel,
}: {
  value?: string | number | readonly string[];
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const options = collectOptions(children);
  return (
    <AdminDropdown
      className={cn("w-full", className)}
      value={value === undefined ? "" : String(value)}
      options={options}
      placeholder={placeholder ?? "Select"}
      active={false}
      disabled={disabled}
      ariaLabel={ariaLabel}
      onChange={(v) => onChange?.({ target: { value: v }, currentTarget: { value: v } } as unknown as React.ChangeEvent<HTMLSelectElement>)}
    />
  );
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
  disabled = false,
  ariaLabel,
}: {
  disabled?: boolean;
  ariaLabel?: string;
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
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border bg-transparent px-3 font-medium transition-colors",
          disabled && "cursor-not-allowed opacity-50",
          h
        )}
        style={{
          borderColor: isActive ? "var(--a-gold)" : open ? "var(--a-gold)" : "var(--a-border)",
          color: isActive ? "var(--a-gold)" : "var(--a-fg)",
        }}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selected?.icon}
          <span className="truncate">
            {label && <span style={{ color: "var(--a-faint)" }}>{label}: </span>}
            {selected?.label ?? placeholder}
          </span>
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
              "absolute z-40 max-h-64 min-w-[max(11rem,100%)] max-w-[min(30rem,90vw)] overflow-y-auto rounded-xl border p-1.5 shadow-xl",
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
                    aria-disabled={o.disabled}
                    disabled={o.disabled}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-4 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      o.disabled && "cursor-not-allowed opacity-40",
                      sel ? "font-medium" : !o.disabled && "hover:bg-black/[0.04]"
                    )}
                    style={{
                      background: sel ? "var(--a-gold-soft)" : undefined,
                      color: sel ? "var(--a-gold)" : "var(--a-fg)",
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {o.icon}
                      {o.label}
                    </span>
                    <span className="flex items-center gap-2">
                      {o.meta && <span className="text-xs font-normal" style={{ color: "var(--a-faint)" }}>{o.meta}</span>}
                      {sel && <Check size={14} />}
                    </span>
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
