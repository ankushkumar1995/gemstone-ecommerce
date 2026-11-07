"use client";

/**
 * Partner panel shell: sidebar (desktop) / slide-over (mobile) + topbar with the
 * Online switch. Navigation items are listed in NAV; pages that need an
 * approved profile are marked so they render a friendly lock for applicants.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gem, LayoutDashboard, LogOut, Menu, ShieldCheck, UserRound, FileCheck2, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { partnerApi } from "@/lib/astrologer-api";
import { Avatar, StatusPill, Toggle, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "./partner-context";
import { STATUS_META } from "./status-meta";

export interface PartnerNavItem { label: string; href: string; icon: LucideIcon }
export const NAV: { title: string; items: PartnerNavItem[] }[] = [
  { title: "Work", items: [{ label: "Dashboard", href: "/astrologer", icon: LayoutDashboard }] },
  {
    title: "Account",
    items: [
      { label: "Profile & rates", href: "/astrologer/profile", icon: UserRound },
      { label: "KYC & payout", href: "/astrologer/kyc", icon: FileCheck2 },
      { label: "Security", href: "/astrologer/security", icon: ShieldCheck },
    ],
  },
];

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col p-3">
      <Link href="/astrologer" onClick={onNavigate} className="mb-5 flex items-center gap-2.5 px-2 py-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#e6b43a] to-[#9169ff] text-white shadow-sm"><Gem size={18} /></span>
        <span className="leading-tight">
          <span className="block text-base font-semibold" style={{ color: "var(--a-fg)" }}>Astrounkle</span>
          <span className="block text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: "var(--a-gold)" }}>Partner</span>
        </span>
      </Link>
      <nav className="flex-1 space-y-5 overflow-y-auto">
        {NAV.map((g) => (
          <div key={g.title}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--a-faint)" }}>{g.title}</p>
            {g.items.map((it) => {
              const active = it.href === "/astrologer" ? pathname === it.href : pathname.startsWith(it.href);
              const Icon = it.icon;
              return (
                <Link key={it.href} href={it.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                  className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", active ? "bg-[var(--a-gold-soft)] text-[var(--a-gold)]" : "text-[var(--a-muted)] hover:bg-black/[0.04] hover:text-[var(--a-fg)]")}>
                  <Icon size={17} />{it.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}

function OnlineSwitch() {
  const { me, goOnline, goOffline, busy } = usePartner();
  const { toast } = useAdminToast();
  if (!me) return null;
  const canGo = me.status === "approved";
  const online = me.presence.online;
  return (
    <div className="flex items-center gap-2" title={canGo ? undefined : "Available after your profile is approved"}>
      <span className={cn("h-2.5 w-2.5 rounded-full", online ? "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]" : "bg-slate-300")} aria-hidden />
      <span className="hidden text-sm font-semibold sm:inline" style={{ color: online ? "var(--a-green)" : "var(--a-muted)" }}>{online ? "Online" : "Offline"}</span>
      <div className={cn(!canGo && "pointer-events-none opacity-50")}>
        <Toggle
          checked={online}
          label={online ? "Go offline" : "Go online"}
          onChange={async (v) => {
            if (busy) return;
            if (v) { const err = await goOnline(); if (err) toast(err, "error"); else toast("You are online. Customers can now reach you.", "success"); }
            else { await goOffline(); toast("You are offline.", "info"); }
          }}
        />
      </div>
    </div>
  );
}

export function PartnerShell({ children }: { children: React.ReactNode }) {
  const { me } = usePartner();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const meta = me ? STATUS_META[me.status] : null;
  const logout = async () => { await partnerApi.auth.logout(); router.replace("/astrologer/login"); };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r lg:block" style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}>
        <div className="sticky top-0 h-screen"><SideNav /></div>
      </aside>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/30 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside className="fixed inset-y-0 left-0 z-50 w-72 border-r lg:hidden" style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", stiffness: 320, damping: 32 }}>
              <button className="absolute right-3 top-3 rounded-lg p-2" aria-label="Close menu" onClick={() => setOpen(false)} style={{ color: "var(--a-muted)" }}><X size={18} /></button>
              <SideNav onNavigate={() => setOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur sm:px-6" style={{ borderColor: "var(--a-border)", background: "color-mix(in srgb, var(--a-surface) 88%, transparent)" }}>
          <button className="rounded-lg p-2 lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)} style={{ color: "var(--a-fg)" }}><Menu size={20} /></button>
          {meta && <StatusPill tone={meta.tone}>{meta.label}</StatusPill>}
          <div className="ml-auto flex items-center gap-4">
            <OnlineSwitch />
            {me && (
              <div className="hidden items-center gap-2 md:flex">
                <Avatar name={me.displayName} src={me.photo} size={32} />
                <span className="max-w-40 truncate text-sm font-medium" style={{ color: "var(--a-fg)" }}>{me.displayName}</span>
              </div>
            )}
            <button onClick={logout} className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-black/[0.04]" style={{ color: "var(--a-muted)" }} aria-label="Sign out">
              <LogOut size={16} /><span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
