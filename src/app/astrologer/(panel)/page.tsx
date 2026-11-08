"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Clock, MessageCircle, Phone, Star, Users, Video, AlertTriangle, ArrowRight } from "lucide-react";
import { REQUIRED_KYC } from "@/modules/astrologers/astrologer.types";
import { partnerApi } from "@/lib/astrologer-api";
import { AdminButton, Card, PageHeader, StatCard, StatsSkeleton, Toggle, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "../_components/partner-context";
import { STATUS_META } from "../_components/status-meta";
import { DashboardToday } from "../_components/dashboard-today";

export default function PartnerDashboard() {
  const { me, loading, setMe, goOnline } = usePartner();
  const { toast } = useAdminToast();
  if (loading || !me) return <StatsSkeleton count={4} />;

  const meta = STATUS_META[me.status];
  const kycDone = (t: string) => me.kyc.find((d) => d.type === t)?.status;
  const steps = [
    { label: "Profile basics", done: Boolean(me.shortBio && me.languages.length && me.expertise.length), href: "/astrologer/profile" },
    { label: "Profile photo", done: Boolean(me.photo), href: "/astrologer/profile" },
    ...REQUIRED_KYC.map((t) => ({ label: `KYC: ${t.replace("_", " ")}`, done: kycDone(t) === "verified", pending: kycDone(t) === "pending", href: "/astrologer/kyc" })),
    { label: "Payout account", done: Boolean(me.payout), href: "/astrologer/kyc" },
    { label: "Profile approved", done: me.status === "approved", href: "/astrologer" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  const selfStatus = async (status: "under_review" | "deactivated") => {
    const res = await partnerApi.setStatus(status);
    if (res.ok) { setMe(res.data); toast(status === "under_review" ? "Sent for review" : "Profile deactivated", "success"); }
    else toast(res.message, "error");
  };
  const setChannel = async (c: "chat" | "call" | "video", v: boolean) => {
    if (!me.presence.online) { const res = await partnerApi.presence("offline", { [c]: v }); if (res.ok) setMe(res.data); else toast(res.message, "error"); return; }
    const err = await goOnline({ ...me.presence.channels, [c]: v });
    if (err) toast(err, "error");
  };

  return (
    <div className="space-y-6">
      <PageHeader title={`Namaste, ${me.displayName.split(" ")[0]}`} subtitle="Your partner dashboard" />

      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Account status: {meta.label}</p>
            <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>{meta.help}</p>
            {me.statusReason && ["rejected", "suspended", "deactivated"].includes(me.status) && (
              <p className="mt-2 flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{me.statusReason}</p>
            )}
            {me.pendingChanges && <p className="mt-2 text-sm" style={{ color: "var(--a-gold)" }}>Your recent name/photo/bio changes are waiting for admin review.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {me.status === "rejected" && <AdminButton onClick={() => selfStatus("under_review")}>Submit for review again</AdminButton>}
            {me.status === "deactivated" && <AdminButton onClick={() => selfStatus("under_review")}>Reactivate profile</AdminButton>}
            {me.status === "applied" && <Link href="/astrologer/kyc"><AdminButton>Upload KYC<ArrowRight size={16} /></AdminButton></Link>}
          </div>
        </div>
      </Card>

      {me.status !== "approved" && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Get live on Astrounkle</p>
            <p className="text-sm" style={{ color: "var(--a-muted)" }}>{doneCount}/{steps.length} done</p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-black/[0.03]" style={{ color: "var(--a-fg)" }}>
                  {s.done ? <CheckCircle2 size={18} className="text-emerald-600" /> : "pending" in s && s.pending ? <Clock size={18} style={{ color: "var(--a-gold)" }} /> : <Circle size={18} style={{ color: "var(--a-faint)" }} />}
                  <span className="capitalize">{s.label}</span>
                  {"pending" in s && s.pending && <span className="text-xs" style={{ color: "var(--a-gold)" }}>in review</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {me.status === "approved" && (
        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold" style={{ color: "var(--a-fg)" }}>What customers can book right now</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              { c: "chat", icon: MessageCircle, label: "Chat" },
              { c: "call", icon: Phone, label: "Voice call" },
              { c: "video", icon: Video, label: "Video call" },
            ] as const).map(({ c, icon: Icon, label }) => {
              const off = me.rates[c] <= 0;
              return (
                <div key={c} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--a-border)" }}>
                  <Icon size={18} style={{ color: "var(--a-gold)" }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>{label}</p>
                    <p className="text-xs" style={{ color: "var(--a-muted)" }}>{off ? "Set a rate to enable" : `₹${me.rates[c]}/min`}</p>
                  </div>
                  <div className={off ? "pointer-events-none opacity-40" : ""}><Toggle checked={!off && me.presence.channels[c]} onChange={(v) => setChannel(c, v)} label={`${label} on or off`} /></div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs" style={{ color: "var(--a-muted)" }}>Keep this tab open while online. If the panel is closed for about a minute you are set offline automatically.</p>
        </Card>
      )}

      {me.status === "approved" && <DashboardToday />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Star} value={me.stats.reviewCount ? me.stats.rating.toFixed(1) : "–"} label={`Rating (${me.stats.reviewCount} reviews)`} tone="gold" />
        <StatCard icon={Users} value={me.stats.totalSessions} label="Consultations" tone="royal" />
        <StatCard icon={Clock} value={me.stats.totalMinutes} label="Minutes served" tone="blue" />
        <StatCard icon={AlertTriangle} value={me.stats.missedRequests} label="Missed requests" tone="rose" />
      </div>
      <p className="text-xs" style={{ color: "var(--a-muted)" }}>Platform commission on your consultations: {me.effectiveCommissionPct}%. Maximum rate allowed: ₹{me.effectiveMaxRate}/min.</p>
    </div>
  );
}
