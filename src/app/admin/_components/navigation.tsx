"use client";

/**
 * Admin navigation & layout helpers: Tabs, Breadcrumb, KeyValue list,
 * Pagination, FilterBar, DateRange. Shared across list/detail pages.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Home, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------- Tabs ---------------- */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 border-b" style={{ borderColor: "var(--a-border)" }}>
      {tabs.map((t) => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active ? "text-[var(--a-gold)]" : "text-[var(--a-muted)] hover:text-[var(--a-fg)]"
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
                style={{
                  background: active ? "var(--a-gold-soft)" : "var(--a-surface-2)",
                  color: active ? "var(--a-gold)" : "var(--a-muted)",
                }}
              >
                {t.count}
              </span>
            )}
            {active && (
              <motion.span
                layoutId="admin-tabs-underline"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                className="absolute inset-x-0 -bottom-px h-0.5 bg-gradient-to-r from-[#e6b43a] to-[#c9942a]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Breadcrumb ---------------- */
export function AdminBreadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="flex items-center gap-1.5 text-sm" style={{ color: "var(--a-muted)" }}>
      <Link href="/admin" className="flex items-center gap-1 hover:text-[var(--a-gold)]">
        <Home size={14} />
      </Link>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            <ChevronRight size={14} style={{ color: "var(--a-faint)" }} />
            {it.href && !last ? (
              <Link href={it.href} className="hover:text-[var(--a-gold)]">
                {it.label}
              </Link>
            ) : (
              <span style={{ color: "var(--a-fg)" }}>{it.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/* ---------------- KeyValue (description list) ---------------- */
export function KeyValueList({
  items,
}: {
  items: { label: string; value: React.ReactNode }[];
}) {
  return (
    <dl className="divide-y" style={{ borderColor: "var(--a-border)" }}>
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center justify-between gap-4 py-3"
          style={{ borderColor: "var(--a-border)" }}
        >
          <dt className="text-sm" style={{ color: "var(--a-muted)" }}>
            {it.label}
          </dt>
          <dd className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------------- Pagination (standalone) ---------------- */
export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1.5">
      <PageBtn disabled={page === 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft size={16} />
      </PageBtn>
      {Array.from({ length: totalPages }).map((_, i) => {
        const p = i + 1;
        const active = p === page;
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              "h-8 min-w-8 rounded-lg px-2 text-sm font-medium transition-colors",
              active ? "text-white" : "hover:bg-black/[0.04]"
            )}
            style={
              active
                ? { background: "var(--a-gold)" }
                : { color: "var(--a-fg)" }
            }
          >
            {p}
          </button>
        );
      })}
      <PageBtn disabled={page === totalPages} onClick={() => onChange(page + 1)}>
        <ChevronRight size={16} />
      </PageBtn>
    </div>
  );
}

function PageBtn({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04] disabled:opacity-40"
      style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------------- FilterBar ---------------- */
export function FilterBar({
  children,
  onClear,
  activeCount = 0,
}: {
  children: React.ReactNode;
  onClear?: () => void;
  activeCount?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      {activeCount > 0 && onClear && (
        <button
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-500/10"
        >
          <X size={13} /> Clear ({activeCount})
        </button>
      )}
    </div>
  );
}

/* ---------------- DateRange (quick presets) ---------------- */
export function DateRange({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const presets = [
    { value: "today", label: "Today" },
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
    { value: "all", label: "All time" },
  ];
  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg border p-1"
      style={{ borderColor: "var(--a-border)" }}
    >
      {presets.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === p.value
              ? "bg-[var(--a-gold-soft)] text-[var(--a-gold)]"
              : "text-[var(--a-muted)] hover:text-[var(--a-fg)]"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
