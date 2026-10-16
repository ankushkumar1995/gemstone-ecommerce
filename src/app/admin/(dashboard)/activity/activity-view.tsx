"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity as ActivityIcon,
  Package,
  ShoppingCart,
  Users,
  TicketPercent,
  RotateCcw,
  Star,
  FileText,
  FileStack,
  GalleryHorizontalEnd,
  Tag,
  Layers,
  Settings,
  Boxes,
  Sparkles,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { AuditEntry, AuditEntity, AuditAction } from "@/modules/audit";
import { adminApi } from "@/lib/admin-api";
import {
  PageHeader,
  Card,
  Badge,
  SearchInput,
  AdminDropdown,
  StatsSkeleton,
  EmptyState,
} from "../../_components";

const ENTITY_ICON: Record<AuditEntity, LucideIcon> = {
  product: Package,
  order: ShoppingCart,
  customer: Users,
  coupon: TicketPercent,
  return: RotateCcw,
  review: Star,
  article: FileText,
  page: FileStack,
  banner: GalleryHorizontalEnd,
  category: Tag,
  collection: Layers,
  settings: Settings,
  inventory: Boxes,
  service: Sparkles,
  user: ShieldCheck,
};

function actionTone(a: AuditAction): "muted" | "gold" | "green" | "blue" | "rose" | "royal" {
  if (a === "create") return "green";
  if (a === "delete") return "rose";
  if (a === "refund") return "rose";
  if (a === "status" || a === "payment") return "blue";
  if (a === "stock") return "gold";
  return "royal";
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

const ENTITIES: { value: string; label: string }[] = [
  { value: "", label: "All entities" },
  { value: "product", label: "Products" },
  { value: "order", label: "Orders" },
  { value: "customer", label: "Customers" },
  { value: "coupon", label: "Coupons" },
  { value: "return", label: "Returns" },
  { value: "review", label: "Reviews" },
];

const ACTIONS: { value: string; label: string }[] = [
  { value: "", label: "All actions" },
  { value: "create", label: "Created" },
  { value: "update", label: "Updated" },
  { value: "delete", label: "Deleted" },
  { value: "status", label: "Status" },
  { value: "payment", label: "Payment" },
  { value: "refund", label: "Refund" },
  { value: "stock", label: "Stock" },
];

export function ActivityView() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await adminApi.audit.list({ entity, action, q });
    if (res.ok) setEntries(res.data);
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, action, q]);

  // group entries by day
  const groups = useMemo(() => {
    const map = new Map<string, AuditEntry[]>();
    for (const e of entries) {
      const key = dayLabel(e.at);
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [entries]);

  return (
    <div>
      <PageHeader title="Activity Log" subtitle="Every action across the admin — who did what, and when." />

      {/* filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="min-w-[14rem] flex-1">
          <SearchInput value={q} onChange={setQ} placeholder="Search activity…" />
        </div>
        <AdminDropdown value={entity} options={ENTITIES} onChange={setEntity} />
        <AdminDropdown value={action} options={ACTIONS} onChange={setAction} />
      </div>

      {loading ? (
        <StatsSkeleton count={3} />
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState title="No activity" message="Admin actions will appear here as they happen." />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([day, items]) => (
            <div key={day}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--a-faint)" }}>
                {day}
              </p>
              <Card className="p-0">
                <ol className="divide-y" style={{ borderColor: "var(--a-border)" }}>
                  {items.map((e, i) => {
                    const Icon = ENTITY_ICON[e.entity] ?? ActivityIcon;
                    return (
                      <motion.li
                        key={e.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.3) }}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: "var(--a-surface-2)", color: "var(--a-gold)" }}
                        >
                          <Icon size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm" style={{ color: "var(--a-fg)" }}>
                            {e.summary}
                          </p>
                          <p className="text-xs" style={{ color: "var(--a-faint)" }}>
                            {e.actor} · {timeOf(e.at)}
                          </p>
                        </div>
                        <Badge tone={actionTone(e.action)}>{e.action}</Badge>
                      </motion.li>
                    );
                  })}
                </ol>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
