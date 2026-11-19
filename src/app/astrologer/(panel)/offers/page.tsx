"use client";

/**
 * Offers (real). The first-chat offer: brand-new customers get free minutes on
 * their first chat; AstroUnkle pays the partner a share for those minutes.
 * Partners take part by default and can stop here. Other campaigns and
 * "happy hours" are not live yet, so they are not shown as working.
 */

import { useCallback, useState } from "react";
import { Gift, Info } from "lucide-react";
import { Badge, Card, PageHeader, StatsSkeleton, Toggle, useAdminToast, useOnMount } from "@/app/admin/_components";
import { partnerApi } from "@/lib/astrologer-api";
import { usePartner } from "../../_components/partner-context";

type State = { firstChat: boolean; freeMinutes: number; payPct: number; maxRate: number; rateOk: boolean };

export default function OffersPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await partnerApi.request<State>("/api/v1/astrologer/offers");
    if (r.ok) setS(r.data); else toast(r.message, "error");
  }, [toast]);
  useOnMount(() => { void load(); });

  async function toggle(v: boolean) {
    setBusy(true);
    const r = await partnerApi.request<State>("/api/v1/astrologer/offers", { method: "PUT", body: JSON.stringify({ firstChat: v }) });
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    setS(r.data);
    toast(v ? "You will get first-chat offer customers." : "You will not get first-chat offer customers.", "success");
  }

  if (loading || !me || !s) return <StatsSkeleton count={2} />;
  const chatRate = me.rates.chat;
  const perMin = Math.floor((chatRate * 100 * (100 - me.effectiveCommissionPct) * s.payPct) / 10_000) / 100;
  const off = s.freeMinutes <= 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Offers" subtitle="Get more new customers" />

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start gap-3">
          <Gift size={22} style={{ color: "var(--a-gold)" }} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold" style={{ color: "var(--a-fg)" }}>First chat free</p>
            <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
              {off ? "This offer is paused by AstroUnkle right now." : `A new customer's first chat starts with ${s.freeMinutes} free minutes. Customers who like you keep chatting at your normal rate.`}
            </p>
          </div>
          {off ? <Badge tone="muted">Paused</Badge> : s.firstChat && s.rateOk ? <Badge tone="green">You are in</Badge> : <Badge tone="muted">You are out</Badge>}
        </div>
        {!off && (
          <>
            <ul className="space-y-1.5 text-sm" style={{ color: "var(--a-fg)" }}>
              <li>• The customer does not pay for the free minutes. <b>AstroUnkle pays you {s.payPct}% of your normal earning</b> for each one{chatRate > 0 ? ` (about ₹${perMin} a minute at your rate)` : ""}.</li>
              <li>• After the free minutes, the chat continues at ₹{chatRate}/min from the customer&apos;s wallet, as usual.</li>
              <li>• Each customer (and each phone number) gets it only once.</li>
              {s.maxRate > 0 && <li>• Only astrologers up to ₹{s.maxRate}/min take part.</li>}
            </ul>
            {!s.rateOk && <p className="flex items-center gap-1.5 text-sm text-amber-700"><Info size={14} /> Your chat rate is above ₹{s.maxRate}/min, so offer customers are not sent to you.</p>}
            <Toggle checked={s.firstChat} onChange={(v) => { if (!busy) void toggle(v); }} label="Take first-chat offer customers" />
            <p className="text-xs" style={{ color: "var(--a-muted)" }}>In your requests, these chats show a green &quot;free min&quot; tag. Declining many of them lowers your response rate like any other request.</p>
          </>
        )}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>More offers</p>
        <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>Festival campaigns and your own &quot;happy hours&quot; discount are coming soon.</p>
      </Card>
    </div>
  );
}
