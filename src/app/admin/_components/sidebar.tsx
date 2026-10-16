"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { adminApi } from "@/lib/admin-api";
import {
  LayoutDashboard,
  BarChart3,
  Package,
  ShoppingCart,
  Inbox,
  Users,
  Star,
  Settings,
  Gem,
  Layers,
  Tag,
  TicketPercent,
  Boxes,
  FileText,
  FileStack,
  GalleryHorizontalEnd,
  RotateCcw,
  ScrollText,
  Wallet,
  Sparkles,
  Activity,
  Image as ImageIcon,
  PanelLeftClose,
  PanelLeft,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Reports", href: "/admin/reports", icon: BarChart3 },
    ],
  },
  {
    title: "Catalog",
    items: [
      { label: "Products", href: "/admin/products", icon: Package },
      { label: "Inventory", href: "/admin/inventory", icon: Boxes },
      { label: "Categories", href: "/admin/categories", icon: Tag },
      { label: "Collections", href: "/admin/collections", icon: Layers },
      { label: "Blog", href: "/admin/blog", icon: FileText },
      { label: "Pages", href: "/admin/pages", icon: FileStack },
      { label: "Media", href: "/admin/media", icon: ImageIcon },
      { label: "Orders", href: "/admin/orders", icon: ShoppingCart, badge: 3 },
      { label: "Returns", href: "/admin/returns", icon: RotateCcw },
    ],
  },
  {
    title: "Customers",
    items: [
      { label: "Leads", href: "/admin/leads", icon: Inbox, badge: 5 },
      { label: "Customers", href: "/admin/customers", icon: Users },
      { label: "Reviews", href: "/admin/reviews", icon: Star },
    ],
  },
  {
    title: "Finance",
    items: [{ label: "Payments", href: "/admin/payments", icon: Wallet }],
  },
  {
    title: "Marketing",
    items: [
      { label: "Coupons", href: "/admin/coupons", icon: TicketPercent },
      { label: "Banners", href: "/admin/banners", icon: GalleryHorizontalEnd },
      { label: "Services", href: "/admin/services", icon: Sparkles },
      { label: "Bookings", href: "/admin/bookings", icon: CalendarClock },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Users & Roles", href: "/admin/users", icon: Users },
      { label: "System Health", href: "/admin/health", icon: Activity },
      { label: "Activity Log", href: "/admin/activity", icon: ScrollText },
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

export function Sidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  // Live "active bookings" count for the Bookings nav badge.
  const [bookingBadge, setBookingBadge] = useState<number | undefined>(undefined);
  useEffect(() => {
    let active = true;
    (async () => {
      const res = await adminApi.bookings.counts();
      if (active && res.ok) setBookingBadge(res.data.active || undefined);
    })();
    return () => {
      active = false;
    };
  }, [pathname]);

  return (
    <div className="flex h-full flex-col p-3">
      {/* brand + collapse toggle */}
      <div className={cn("mb-5 flex items-center gap-2.5 px-2 py-1", collapsed && "justify-center px-0")}>
        <Link href="/admin" onClick={onNavigate} className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#e6b43a] to-[#9169ff] text-white shadow-sm">
            <Gem size={18} />
          </span>
          {!collapsed && (
            <span className="text-lg font-semibold" style={{ color: "var(--a-fg)" }}>
              Astrounkle
            </span>
          )}
        </Link>
        {!collapsed && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="ml-auto hidden h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.04] lg:flex"
            style={{ color: "var(--a-muted)" }}
          >
            <PanelLeftClose size={17} />
          </button>
        )}
      </div>

      {/* expand button when collapsed */}
      {collapsed && onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          aria-label="Expand sidebar"
          className="mb-3 hidden h-9 w-full items-center justify-center rounded-lg transition-colors hover:bg-black/[0.04] lg:flex"
          style={{ color: "var(--a-muted)" }}
        >
          <PanelLeft size={17} />
        </button>
      )}

      {/* nav groups */}
      <nav className="admin-nav-scroll flex-1 space-y-5 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <p
                className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--a-faint)" }}
              >
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                // Override the Bookings badge with the live active count.
                const navItem =
                  item.href === "/admin/bookings" ? { ...item, badge: bookingBadge } : item;
                return (
                  <NavLink
                    key={item.href}
                    item={navItem}
                    active={
                      item.href === "/admin"
                        ? pathname === "/admin"
                        : pathname.startsWith(item.href)
                    }
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* footer / help card */}
      {!collapsed ? (
        <div
          className="mt-4 rounded-xl border p-3"
          style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}
        >
          <p className="text-xs font-semibold" style={{ color: "var(--a-fg)" }}>
            Need help?
          </p>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--a-muted)" }}>
            Check docs or contact support.
          </p>
          <a
            href="/contact"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-[11px] font-semibold text-[var(--a-gold)] hover:underline"
          >
            Get support →
          </a>
        </div>
      ) : (
        <div className="mt-4 text-center text-[10px]" style={{ color: "var(--a-faint)" }}>
          v1.0
        </div>
      )}
    </div>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "text-[var(--a-gold)]"
          : "text-[var(--a-muted)] hover:bg-black/[0.04] hover:text-[var(--a-fg)]"
      )}
      style={active ? { background: "var(--a-gold-soft)" } : undefined}
    >
      {/* left accent bar on active */}
      {active && (
        <motion.span
          layoutId="admin-nav-accent"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full"
          style={{ background: "var(--a-gold)" }}
        />
      )}
      <motion.span
        whileHover={{ scale: 1.12 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className="shrink-0"
      >
        <item.icon size={18} />
      </motion.span>

      {!collapsed && <span className="flex-1">{item.label}</span>}

      {/* badge */}
      {item.badge && !collapsed && (
        <span
          className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold"
          style={{
            background: active ? "var(--a-gold)" : "var(--a-surface-2)",
            color: active ? "#fff" : "var(--a-muted)",
          }}
        >
          {item.badge}
        </span>
      )}
      {/* collapsed badge dot */}
      {item.badge && collapsed && (
        <span
          className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
          style={{ background: "var(--a-gold)" }}
        />
      )}
    </Link>
  );
}
