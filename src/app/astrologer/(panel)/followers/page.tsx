"use client";

/**
 * Followers (real). Customers who follow you get an in-app alert when you go
 * live (and a phone notification once the app build supports it). Names are
 * shown as first name only.
 */

import { useCallback, useState } from "react";
import Link from "next/link";
import { BellRing, Heart, Radio, TrendingUp, UserPlus } from "lucide-react";
import { AdminButton, Badge, Card, PageHeader, StatCard, StatsSkeleton, useAdminToast, useOnMount } from "@/app/admin/_components";
import { partnerApi } from "@/lib/astrologer-api";

type Data = { total: number; last7: number; last30: number; alertsOn: number; items: { name: string; via: string; alerts: boolean; at: string }[]; nextCursor: string | null };
const VIA: Record<string, string> = { profile: "Profile", live: "Live", chat: "Chat", card: "Search" };

export default function FollowersPage() {
  const { toast } = useAdminToast();
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (cursor?: string) => {
    setBusy(true);
    const r = await partnerApi.request<Data>(`/api/v1/astrologer/followers${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    setD((cur) => (cursor && cur ? { ...r.data, items: [...cur.items, ...r.data.items] } : r.data));
  }, [toast]);
  useOnMount(() => { void load(); });

  if (!d) return <StatsSkeleton count={4} />;
  const pct = d.total ? Math.round((d.alertsOn / d.total) * 100) : 0;
  return (
    <div className="space-y-6">
      <PageHeader title="Followers" subtitle="People who follow you are told in the app when you go live. Go live often to grow."
        action={<Link href="/astrologer/live"><AdminButton><Radio size={15} /> Go live</AdminButton></Link>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Heart} value={d.total} label="Followers" />
        <StatCard icon={UserPlus} value={`+${d.last7}`} label="This week" tone="green" />
        <StatCard icon={TrendingUp} value={`+${d.last30}`} label="Last 30 days" tone="royal" />
        <StatCard icon={BellRing} value={`${pct}%`} label="Get your live alerts" />
      </div>
      <Card className="p-0">
        <p className="border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>Newest followers</p>
        {d.items.length === 0 ? <p className="py-12 text-center text-sm" style={{ color: "var(--a-muted)" }}>No followers yet. Viewers can follow you from your profile and your lives.</p> : (
          <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
            {d.items.map((f, i) => (
              <li key={`${f.at}-${i}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="flex-1 font-medium" style={{ color: "var(--a-fg)" }}>{f.name}</span>
                <Badge tone="muted">from {VIA[f.via] ?? f.via}</Badge>
                {!f.alerts && <Badge tone="gold">alerts off</Badge>}
                <span className="text-xs" style={{ color: "var(--a-muted)" }}>{new Date(f.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              </li>
            ))}
          </ul>
        )}
        {d.nextCursor && <div className="p-3 text-center"><AdminButton variant="outline" loading={busy} onClick={() => load(d.nextCursor!)}>Load more</AdminButton></div>}
      </Card>
    </div>
  );
}
