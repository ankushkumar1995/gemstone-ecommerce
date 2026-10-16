"use client";

/**
 * Small shared admin primitives: Badge, SearchInput, Avatar, CopyButton,
 * Tooltip, ProgressBar, SegmentedControl. Each is tiny and reusable.
 */

import { useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------- Badge ---------------- */
export function Badge({
  children,
  tone = "muted",
  dot = false,
}: {
  children: React.ReactNode;
  tone?: "muted" | "gold" | "green" | "blue" | "rose" | "royal";
  dot?: boolean;
}) {
  const tones: Record<string, string> = {
    muted: "bg-black/[0.06] text-[var(--a-muted)]",
    gold: "bg-[var(--a-gold-soft)] text-[var(--a-gold)]",
    green: "bg-emerald-500/12 text-emerald-700",
    blue: "bg-sky-500/12 text-sky-700",
    rose: "bg-rose-500/12 text-rose-700",
    royal: "bg-[var(--a-royal-soft)] text-[var(--a-royal)]",
  };
  const dotColor: Record<string, string> = {
    muted: "bg-[var(--a-muted)]",
    gold: "bg-[var(--a-gold)]",
    green: "bg-emerald-500",
    blue: "bg-sky-500",
    rose: "bg-rose-500",
    royal: "bg-[var(--a-royal)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone]
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[tone])} />}
      {children}
    </span>
  );
}

/* ---------------- SearchInput ---------------- */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        style={{ color: "var(--a-muted)" }}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-[var(--a-faint)] focus:border-[var(--a-gold)]"
        style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
      />
    </div>
  );
}

/* ---------------- Avatar ---------------- */
export function Avatar({
  name,
  src,
  size = 36,
}: {
  name: string;
  src?: string;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#9169ff] to-[#6a2ee0] font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}

/* ---------------- CopyButton ---------------- */
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-[var(--a-gold)]"
      style={{ color: "var(--a-muted)" }}
    >
      {label && <span>{label}</span>}
      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
    </button>
  );
}

/* ---------------- Tooltip ---------------- */
export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.14 }}
            className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-white shadow-lg"
            style={{ background: "var(--a-fg)" }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/* ---------------- ProgressBar ---------------- */
export function ProgressBar({
  value,
  tone = "gold",
}: {
  value: number; // 0–100
  tone?: "gold" | "green" | "rose";
}) {
  const colors = {
    gold: "from-[#e6b43a] to-[#c9942a]",
    green: "from-emerald-400 to-emerald-500",
    rose: "from-rose-400 to-rose-500",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--a-surface-2)" }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn("h-full rounded-full bg-gradient-to-r", colors[tone])}
      />
    </div>
  );
}

/* ---------------- SegmentedControl ---------------- */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  // Unique per instance — a shared layoutId made the active pill jump between
  // different SegmentedControls on the same page (one showed, another didn't).
  const uid = useId();
  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg border p-1"
      style={{ borderColor: "var(--a-border)" }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className="relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          style={{ color: value === o.value ? "#fff" : "var(--a-muted)" }}
        >
          {value === o.value && (
            <motion.span
              layoutId={`segmented-active-${uid}`}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="absolute inset-0 rounded-md bg-gradient-to-r from-[#e6b43a] to-[#c9942a]"
            />
          )}
          <span className="relative z-10">{o.label}</span>
        </button>
      ))}
    </div>
  );
}


