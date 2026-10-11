"use client";

/**
 * StatCard — a reusable metric card for dashboards & overviews (revenue,
 * orders, leads…). Animated entrance, hover lift + colored glow, icon pop.
 */

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { Card } from "./ui";
import { cn } from "@/lib/utils";

export type StatTone = "gold" | "blue" | "green" | "rose" | "royal";

const glow: Record<StatTone, string> = {
  gold: "rgba(201,148,42,0.14)",
  blue: "rgba(2,132,199,0.12)",
  green: "rgba(5,150,105,0.12)",
  rose: "rgba(225,29,72,0.12)",
  royal: "rgba(122,69,245,0.12)",
};

export function StatCard({
  icon: Icon,
  value,
  label,
  change,
  trend = "up",
  tone = "gold",
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  change?: string;
  trend?: "up" | "down";
  tone?: StatTone;
}) {
  return (
    <Card hover className="group relative overflow-hidden p-4">
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: glow[tone] }}
      />
      <div className="relative flex items-start justify-between">
        <motion.span
          whileHover={{ scale: 1.08, rotate: 4 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: "var(--a-surface-2)", color: "var(--a-gold)" }}
        >
          <Icon size={18} />
        </motion.span>
        {change && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
              trend === "up" ? "bg-emerald-500/12 text-emerald-700" : "bg-rose-500/12 text-rose-700"
            )}
          >
            {trend === "up" ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {change}
          </span>
        )}
      </div>
      <p className="relative mt-3 text-xl font-bold" style={{ color: "var(--a-fg)" }}>
        {value}
      </p>
      <p className="relative text-sm" style={{ color: "var(--a-muted)" }}>
        {label}
      </p>
    </Card>
  );
}
