"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  IndianRupee,
  ShoppingCart,
  Inbox,
  Package,
  ArrowUpRight,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { Card, PageHeader, StatusPill } from "../_components/ui";

const stats = [
  { label: "Total Revenue", value: "₹4,82,900", change: "+12.5%", icon: IndianRupee, tone: "gold" as const, glow: "rgba(201,148,42,0.14)" },
  { label: "Orders", value: "128", change: "+8.2%", icon: ShoppingCart, tone: "blue" as const, glow: "rgba(2,132,199,0.12)" },
  { label: "New Leads", value: "34", change: "+21%", icon: Inbox, tone: "green" as const, glow: "rgba(5,150,105,0.12)" },
  { label: "Products", value: "12", change: "Live", icon: Package, tone: "muted" as const, glow: "rgba(122,69,245,0.12)" },
];

const recent = [
  { id: "NK-2026-4821", name: "Royal Ruby Signet Ring", amount: "₹42,999", status: "shipped", tone: "blue" as const },
  { id: "NK-2026-4820", name: "Blue Sapphire — Loose", amount: "₹44,999", status: "confirmed", tone: "gold" as const },
  { id: "NK-2026-4819", name: "Emerald Vine Pendant", amount: "₹35,999", status: "delivered", tone: "green" as const },
  { id: "NK-2026-4818", name: "Pearl Moon Pendant", amount: "₹18,999", status: "confirmed", tone: "gold" as const },
];

const quickActions = [
  { label: "Manage Leads", href: "/admin/leads", icon: Inbox },
  { label: "Add Product", href: "/admin/products", icon: Package },
  { label: "View Orders", href: "/admin/orders", icon: ShoppingCart },
];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

export function DashboardOverview() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Welcome back — here's what's happening in your store."
      />

      {/* stats */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map((s) => (
          <motion.div key={s.label} variants={item}>
            <Card hover className="group relative overflow-hidden p-4">
              {/* hover glow */}
              <div
                className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: s.glow }}
              />
              <div className="relative flex items-start justify-between">
                <motion.span
                  whileHover={{ scale: 1.08, rotate: 4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: "var(--a-surface-2)", color: "var(--a-gold)" }}
                >
                  <s.icon size={18} />
                </motion.span>
                <StatusPill tone={s.tone}>
                  <TrendingUp size={11} /> {s.change}
                </StatusPill>
              </div>
              <p className="relative mt-3 text-xl font-bold" style={{ color: "var(--a-fg)" }}>
                {s.value}
              </p>
              <p className="relative text-sm" style={{ color: "var(--a-muted)" }}>
                {s.label}
              </p>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* recent orders + quick actions */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <motion.div variants={item} initial="hidden" animate="show">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>
                Recent Orders
              </h2>
              <Link
                href="/admin/orders"
                className="group flex items-center gap-1 text-sm font-medium"
                style={{ color: "var(--a-gold)" }}
              >
                View all
                <ArrowUpRight
                  size={14}
                  className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Link>
            </div>
            <div className="space-y-1">
              {recent.map((o) => (
                <motion.div
                  key={o.id}
                  whileHover={{ x: 4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 26 }}
                  className="group flex cursor-pointer items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-black/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" style={{ color: "var(--a-fg)" }}>
                      {o.name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--a-faint)" }}>
                      {o.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill tone={o.tone}>{o.status}</StatusPill>
                    <span className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>
                      {o.amount}
                    </span>
                    <ChevronRight
                      size={15}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: "var(--a-muted)" }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item} initial="hidden" animate="show">
          <Card>
            <h2 className="mb-4 font-semibold" style={{ color: "var(--a-fg)" }}>
              Quick Actions
            </h2>
            <div className="space-y-2">
              {quickActions.map((a) => (
                <motion.div
                  key={a.href}
                  whileHover={{ x: 4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 26 }}
                >
                  <Link
                    href={a.href}
                    className="group flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:border-[var(--a-gold)] hover:bg-[var(--a-gold-soft)]"
                    style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                      style={{ background: "var(--a-surface-2)", color: "var(--a-gold)" }}
                    >
                      <a.icon size={16} />
                    </span>
                    {a.label}
                    <ArrowUpRight
                      size={15}
                      className="ml-auto transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      style={{ color: "var(--a-muted)" }}
                    />
                  </Link>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
