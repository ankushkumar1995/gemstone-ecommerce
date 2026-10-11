"use client";

/**
 * Shared admin form controls — Field wrapper, Textarea, Select, Toggle — so
 * every add/edit form looks and behaves identically. Pair with AdminInput
 * from ui.tsx.
 */

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-sm font-medium" style={{ color: "var(--a-fg)" }}>
        {label}
        {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs" style={{ color: "var(--a-faint)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

export function AdminTextarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-none rounded-lg border bg-transparent px-4 py-2.5 text-sm outline-none transition-colors",
        "placeholder:text-[var(--a-faint)] focus:border-[var(--a-gold)]",
        className
      )}
      style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
      {...props}
    />
  );
}

export function AdminSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          "w-full appearance-none rounded-lg border bg-transparent px-4 py-2.5 pr-10 text-sm outline-none transition-colors focus:border-[var(--a-gold)]",
          className
        )}
        style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
        style={{ color: "var(--a-muted)" }}
      />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5"
    >
      <span
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          checked ? "bg-[var(--a-gold)]" : "bg-black/[0.12]"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[1.375rem]" : "left-0.5"
          )}
        />
      </span>
      {label && (
        <span className="text-sm" style={{ color: "var(--a-fg)" }}>
          {label}
        </span>
      )}
    </button>
  );
}
