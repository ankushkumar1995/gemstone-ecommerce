"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  Search,
  LogOut,
  Bell,
  ChevronDown,
  Settings,
  User,
  ExternalLink,
} from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { GlobalSearch } from "./global-search";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  // ⌘K / Ctrl+K opens global search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const logout = async () => {
    await adminApi.logout();
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <header
      className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-xl sm:px-6"
      style={{
        borderColor: "var(--a-border)",
        background: "color-mix(in srgb, var(--a-bg) 85%, transparent)",
      }}
    >
      {/* mobile menu */}
      <button
        onClick={onMenu}
        aria-label="Open menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/[0.04] lg:hidden"
        style={{ color: "var(--a-fg)" }}
      >
        <Menu size={20} />
      </button>

      {/* search (compact, with shortcut hint) */}
      <button
        onClick={() => setSearchOpen(true)}
        className="group flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors hover:border-[var(--a-border-strong)] lg:w-80"
        style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}
      >
        <Search size={15} />
        <span className="hidden lg:block">Search…</span>
        <kbd
          className="ml-auto hidden rounded border px-1.5 py-0.5 text-[10px] font-medium lg:block"
          style={{ borderColor: "var(--a-border)", color: "var(--a-faint)" }}
        >
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        {/* View Store — opens the live customer site */}
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-[var(--a-gold)] hover:text-[var(--a-gold)] md:flex"
          style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
        >
          <ExternalLink size={15} /> View Store
        </a>

        {/* divider */}
        <span className="mx-1 hidden h-6 w-px md:block" style={{ background: "var(--a-border)" }} />
        {/* notifications */}
        <button
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/[0.04]"
          style={{ color: "var(--a-muted)" }}
        >
          <Bell size={18} />
          <span
            className="absolute right-2 top-2 h-2 w-2 rounded-full ring-2"
            style={{ background: "var(--a-gold)", ["--tw-ring-color" as string]: "var(--a-bg)" }}
          />
        </button>

        {/* divider */}
        <span className="mx-1 hidden h-6 w-px sm:block" style={{ background: "var(--a-border)" }} />

        {/* profile dropdown */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-black/[0.04]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#9169ff] to-[#6a2ee0] text-xs font-bold text-white">
              A
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-semibold leading-none" style={{ color: "var(--a-fg)" }}>
                Admin
              </span>
              <span className="block text-[11px] leading-none" style={{ color: "var(--a-faint)" }}>
                Store Owner
              </span>
            </span>
            <ChevronDown
              size={15}
              className={`transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
              style={{ color: "var(--a-muted)" }}
            />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.16 }}
                className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border shadow-xl"
                style={{ background: "var(--a-surface)", borderColor: "var(--a-border)" }}
              >
                <div className="border-b px-4 py-3" style={{ borderColor: "var(--a-border)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>
                    Store Admin
                  </p>
                  <p className="text-xs" style={{ color: "var(--a-muted)" }}>
                    admin@nakshatra.com
                  </p>
                </div>
                <div className="p-1.5">
                  <MenuItem href="/admin/settings" icon={User} label="Profile" onClick={() => setMenuOpen(false)} />
                  <MenuItem href="/admin/settings" icon={Settings} label="Settings" onClick={() => setMenuOpen(false)} />
                </div>
                <div className="border-t p-1.5" style={{ borderColor: "var(--a-border)" }}>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-500/10"
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}

function MenuItem({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-black/[0.04]"
      style={{ color: "var(--a-fg)" }}
    >
      <Icon size={16} style={{ color: "var(--a-muted)" }} />
      {label}
    </Link>
  );
}
