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
import {
  Gem, LayoutDashboard, LogOut, Menu, ShieldCheck, UserRound, FileCheck2, X, BellRing, MessagesSquare, History, CalendarDays,
  IndianRupee, Landmark, Star, Users, Gauge, Bell, LifeBuoy, ShoppingBag, BadgePercent, ListOrdered, MessageSquareReply,
  HeartPulse, Smartphone, Radio, Heart, BarChart3, Receipt, Gift, FileSignature, Lock, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { partnerApi } from "@/lib/astrologer-api";
import { Avatar, StatusPill, Toggle, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "./partner-context";
import { STATUS_META } from "./status-meta";
import { MOCK_NOTIFICATIONS } from "./mock-data";
import { BreakBanner, BreakButton } from "./break-control";
import { InstallNudge } from "./pwa";
import { QueueWatcher } from "./queue";
import { LiveBanner } from "./live-banner";
import { FOLLOWER_ALERT_COOLDOWN_MS, agreementStore, deletionStore, followerSettingsStore, useStore } from "./demo-store";
import { AGREEMENT } from "./agreement-text";
import { MOCK_FOLLOWER_GROWTH } from "./mock-data";
import { nowMs } from "./demo";

/** Demo unread count until notifications are wired to the backend. */
const DEMO_UNREAD = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;
const FOLLOWERS_NOW = MOCK_FOLLOWER_GROWTH[MOCK_FOLLOWER_GROWTH.length - 1];

export interface PartnerNavItem { label: string; href: string; icon: LucideIcon }
export const NAV: { title: string; items: PartnerNavItem[] }[] = [
  {
    title: "Work",
    items: [
      { label: "Dashboard", href: "/astrologer", icon: LayoutDashboard },
      { label: "Live requests", href: "/astrologer/requests", icon: BellRing },
      { label: "Active session", href: "/astrologer/session", icon: MessagesSquare },
      { label: "Waitlist", href: "/astrologer/waitlist", icon: ListOrdered },
      { label: "Free follow-ups", href: "/astrologer/follow-ups", icon: MessageSquareReply },
      { label: "Go live", href: "/astrologer/live", icon: Radio },
      { label: "Sessions history", href: "/astrologer/sessions", icon: History },
      { label: "Schedule", href: "/astrologer/schedule", icon: CalendarDays },
    ],
  },
  {
    title: "Money",
    items: [
      { label: "Earnings", href: "/astrologer/earnings", icon: IndianRupee },
      { label: "Payouts", href: "/astrologer/payouts", icon: Landmark },
      { label: "Remedy sales", href: "/astrologer/remedies", icon: ShoppingBag },
      { label: "Tax & invoices", href: "/astrologer/tax", icon: Receipt },
    ],
  },
  {
    title: "Growth",
    items: [
      { label: "Profile insights", href: "/astrologer/insights", icon: BarChart3 },
      { label: "Followers", href: "/astrologer/followers", icon: Heart },
      { label: "Reviews", href: "/astrologer/reviews", icon: Star },
      { label: "My customers", href: "/astrologer/customers", icon: Users },
      { label: "Performance", href: "/astrologer/performance", icon: Gauge },
      { label: "Offers", href: "/astrologer/offers", icon: BadgePercent },
      { label: "Refer & earn", href: "/astrologer/referral", icon: Gift },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Profile & rates", href: "/astrologer/profile", icon: UserRound },
      { label: "KYC & payout", href: "/astrologer/kyc", icon: FileCheck2 },
      { label: "Security", href: "/astrologer/security", icon: ShieldCheck },
      { label: "Account health", href: "/astrologer/health", icon: HeartPulse },
      { label: "App & alerts", href: "/astrologer/app", icon: Smartphone },
      { label: "Partner agreement", href: "/astrologer/agreement", icon: FileSignature },
      { label: "Privacy & data", href: "/astrologer/privacy", icon: Lock },
      { label: "Notifications", href: "/astrologer/notifications", icon: Bell },
      { label: "Help & guidelines", href: "/astrologer/help", icon: LifeBuoy },
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
              const active = it.href === "/astrologer" ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`);
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
            if (v) {
              // After the deadline, the current agreement must be signed to go online.
              if (nowMs() > Date.parse(AGREEMENT.deadlineIso) && !agreementStore.get().some((a) => a.version === AGREEMENT.version)) {
                toast(`Sign partner agreement v${AGREEMENT.version} to go online.`, "error");
                return;
              }
              const err = await goOnline();
              if (err) { toast(err, "error"); return; }
              // Followers get an "online now" alert at most once every 3 hours.
              const f = followerSettingsStore.get();
              const t = nowMs();
              const canAlert = f.autoNotify && (f.lastNotifiedAt === null || t - f.lastNotifiedAt >= FOLLOWER_ALERT_COOLDOWN_MS);
              if (canAlert) followerSettingsStore.set({ ...f, lastNotifiedAt: t });
              toast(canAlert ? `You are online. ${FOLLOWERS_NOW.toLocaleString("en-IN")} followers were alerted.` : "You are online. Customers can now reach you.", "success");
            }
            else { await goOffline(); toast("You are offline.", "info"); }
          }}
        />
      </div>
    </div>
  );
}

/** Pending agreement signature and scheduled account deletion, on every page. */
function AccountNotices() {
  const pathname = usePathname();
  const signed = useStore(agreementStore).some((a) => a.version === AGREEMENT.version);
  const deletion = useStore(deletionStore);
  const { me } = usePartner();
  if (!me) return null;
  return (
    <>
      {deletion && pathname !== "/astrologer/privacy" && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="status">
          <p className="flex-1">Your account is scheduled for deletion on <b>{new Date(deletion.scheduledFor).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</b>.</p>
          <Link href="/astrologer/privacy" className="font-semibold underline">Cancel deletion</Link>
        </div>
      )}
      {!signed && me.status === "approved" && pathname !== "/astrologer/agreement" && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--a-gold)", background: "var(--a-gold-soft)", color: "var(--a-fg)" }} role="status">
          <p className="flex-1">Partner agreement <b>v{AGREEMENT.version}</b> needs your signature by {AGREEMENT.deadline}.</p>
          <Link href="/astrologer/agreement" className="font-semibold" style={{ color: "var(--a-gold)" }}>Review and sign</Link>
        </div>
      )}
    </>
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
            <Link href="/astrologer/followers" className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-black/[0.04] sm:flex" style={{ color: "var(--a-muted)" }} aria-label={`${FOLLOWERS_NOW} followers`}>
              <Heart size={16} className="text-rose-500" /> {FOLLOWERS_NOW.toLocaleString("en-IN")}
            </Link>
            <BreakButton />
            <OnlineSwitch />
            <Link href="/astrologer/notifications" className="relative rounded-lg p-2 hover:bg-black/[0.04]" aria-label={`Notifications, ${DEMO_UNREAD} unread`} style={{ color: "var(--a-muted)" }}>
              <Bell size={18} />
              {DEMO_UNREAD > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">{DEMO_UNREAD}</span>}
            </Link>
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
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6"><QueueWatcher /><AccountNotices /><LiveBanner /><BreakBanner /><InstallNudge />{children}</main>
      </div>
    </div>
  );
}
