"use client";

/**
 * Admin UI primitives — small, shared building blocks so every admin page
 * looks consistent and page files stay short. All use the `.admin-root`
 * tokens (var(--a-*)) and ship with subtle motion + hover polish.
 */

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  hover = false,
  ...props
}: HTMLMotionProps<"div"> & {
  children: React.ReactNode;
  className?: string;
  /** adds a lift + border-highlight interaction on hover */
  hover?: boolean;
}) {
  return (
    <motion.div
      className={cn(
        "rounded-lg border p-5 transition-colors duration-300",
        hover && "hover:border-[var(--a-border-strong)]",
        className
      )}
      style={{
        background: "var(--a-surface)",
        borderColor: "var(--a-border)",
        boxShadow: "0 1px 2px rgba(20,20,40,0.04)",
      }}
      whileHover={
        hover
          ? { y: -3, boxShadow: "0 18px 40px -22px rgba(20,20,40,0.35)" }
          : undefined
      }
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--a-fg)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function AdminButton({
  children,
  variant = "primary",
  className,
  ...props
}: Omit<HTMLMotionProps<"button">, "ref"> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const styles: Record<string, string> = {
    primary:
      "text-white bg-gradient-to-r from-[#e6b43a] to-[#c9942a] hover:brightness-105 shadow-[0_8px_20px_-10px_rgba(201,148,42,0.6)]",
    ghost: "text-[var(--a-fg)] hover:bg-black/[0.04]",
    outline: "border border-[var(--a-border-strong)] text-[var(--a-fg)] hover:bg-black/[0.04]",
    danger: "text-white bg-rose-500 hover:bg-rose-600",
  };
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={cn(base, styles[variant], className)}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function AdminInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm outline-none transition-colors",
        "placeholder:text-[var(--a-faint)] focus:border-[var(--a-gold)]",
        className
      )}
      style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
      {...props}
    />
  );
}

export function StatusPill({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "gold" | "green" | "blue" | "rose";
}) {
  const tones: Record<string, string> = {
    muted: "bg-black/[0.06] text-[var(--a-muted)]",
    gold: "bg-[var(--a-gold-soft)] text-[var(--a-gold)]",
    green: "bg-emerald-500/12 text-emerald-700",
    blue: "bg-sky-500/12 text-sky-700",
    rose: "bg-rose-500/12 text-rose-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium capitalize",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}
