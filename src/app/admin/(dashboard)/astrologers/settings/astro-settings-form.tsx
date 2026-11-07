"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { AstroProgramSettings } from "@/modules/astro-settings/astro-settings";
import { astroAdminApi } from "@/lib/admin-astro-api";
import { AdminBreadcrumb, AdminButton, AdminInput, AdminSelect, Card, Field, PageHeader, StatsSkeleton, Toggle, useAdminToast, useOnMount } from "../../../_components";

type S = AstroProgramSettings;

function Num({ label, hint, value, onChange, step = 1 }: { label: string; hint?: string; value: number; onChange: (n: number) => void; step?: number }) {
  return <Field label={label} hint={hint}><AdminInput type="number" step={step} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))} /></Field>;
}

export function AstroSettingsForm() {
  const { toast } = useAdminToast();
  const [s, setS] = useState<S | null>(null);
  const [saving, setSaving] = useState(false);
  useOnMount(async () => { const r = await astroAdminApi.settings.get(); if (r.ok) setS(r.data); else toast(r.message, "error"); });
  if (!s) return <StatsSkeleton count={3} />;
  const set = <K extends keyof S>(k: K, v: S[K]) => setS({ ...s, [k]: v });

  const save = async () => {
    setSaving(true);
    const { updatedAt: _u, ...rest } = s;
    void _u;
    const r = await astroAdminApi.settings.update(rest);
    setSaving(false);
    if (r.ok) { setS(r.data); toast("Program settings saved", "success"); } else toast(r.message, "error");
  };

  return (
    <div className="space-y-6">
      <AdminBreadcrumb items={[{ label: "Astrologers", href: "/admin/astrologers" }, { label: "Program settings" }]} />
      <PageHeader title="Astrologer program settings" subtitle="Business rules used by onboarding, consultations, wallets and payouts." action={<AdminButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</AdminButton>} />

      <Card className="space-y-4 p-5">
        <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Commission & rates</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Num label="Platform commission (%)" hint="Kept from every consultation" value={s.commissionPct} step={0.5} onChange={(n) => set("commissionPct", n)} />
          <Num label="Minimum rate (₹/min)" value={s.minRate} onChange={(n) => set("minRate", n)} />
          <Num label="Maximum rate (₹/min)" value={s.maxRate} onChange={(n) => set("maxRate", n)} />
          <Num label="Default chat rate" value={s.defaultRates.chat} onChange={(n) => set("defaultRates", { ...s.defaultRates, chat: n })} />
          <Num label="Default call rate" value={s.defaultRates.call} onChange={(n) => set("defaultRates", { ...s.defaultRates, call: n })} />
          <Num label="Default video rate" value={s.defaultRates.video} onChange={(n) => set("defaultRates", { ...s.defaultRates, video: n })} />
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Onboarding & moderation</p>
        <div className="flex flex-wrap gap-6">
          <Toggle checked={s.requireKycForApproval} onChange={(v) => set("requireKycForApproval", v)} label="Require verified KYC to approve / go online" />
          <Toggle checked={s.reviewProfileEdits} onChange={(v) => set("reviewProfileEdits", v)} label="Review name/photo/bio edits" />
          <Toggle checked={s.moderateReviews} onChange={(v) => set("moderateReviews", v)} label="Moderate customer reviews" />
          <Toggle checked={s.maskContactInfo} onChange={(v) => set("maskContactInfo", v)} label="Mask phone/email/UPI in chats" />
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Consultations</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Num label="Minimum balance (minutes)" hint="Needed to start a session" value={s.minStartMinutes} onChange={(n) => set("minStartMinutes", n)} />
          <Num label="Accept timeout (sec)" value={s.requestTimeoutSec} onChange={(n) => set("requestTimeoutSec", n)} />
          <Num label="Join timeout (sec)" value={s.joinTimeoutSec} onChange={(n) => set("joinTimeoutSec", n)} />
          <Num label="Idle auto-end (sec)" hint="No heartbeat from either side" value={s.idleTimeoutSec} onChange={(n) => set("idleTimeoutSec", n)} />
          <Num label="Presence stale after (sec)" value={s.presenceStaleSec} onChange={(n) => set("presenceStaleSec", n)} />
          <Num label="Missed requests before auto-offline" value={s.maxMissedBeforeOffline} onChange={(n) => set("maxMissedBeforeOffline", n)} />
          <Num label="Free minutes on first session" value={s.firstSessionFreeMinutes} onChange={(n) => set("firstSessionFreeMinutes", n)} />
        </div>
        <Toggle checked={s.billFromFirstReply} onChange={(v) => set("billFromFirstReply", v)} label="Start chat billing only after the astrologer's first reply" />
      </Card>

      <Card className="space-y-4 p-5">
        <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Payouts & tax</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Num label="Hold period (days)" hint="Dispute window before earnings are payable" value={s.holdDays} onChange={(n) => set("holdDays", n)} />
          <Num label="Minimum payout (₹)" value={s.payoutMinAmount} onChange={(n) => set("payoutMinAmount", n)} />
          <Field label="Payout cycle"><AdminSelect value={s.payoutCycle} onChange={(e) => set("payoutCycle", e.target.value as S["payoutCycle"])}><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option></AdminSelect></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Toggle checked={s.gst.enabled} onChange={(v) => set("gst", { ...s.gst, enabled: v })} label="Charge GST on wallet recharge" /><Num label="GST rate (%)" value={s.gst.ratePct} step={0.5} onChange={(n) => set("gst", { ...s.gst, ratePct: n })} /></div>
          <div className="space-y-2"><Toggle checked={s.tds.enabled} onChange={(v) => set("tds", { ...s.tds, enabled: v })} label="Deduct TDS on payouts" /><Num label="TDS rate (%)" value={s.tds.ratePct} step={0.5} onChange={(n) => set("tds", { ...s.tds, ratePct: n })} /></div>
        </div>
        <p className="text-xs" style={{ color: "var(--a-muted)" }}>Confirm GST and TDS treatment with your chartered accountant before turning these on.</p>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Wallet recharge packs</p><AdminButton variant="outline" onClick={() => set("rechargePacks", [...s.rechargePacks, { amount: 300, bonus: 0, tag: "" }])} disabled={s.rechargePacks.length >= 12}><Plus size={15} />Add pack</AdminButton></div>
        {s.rechargePacks.map((p, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Num label="Pay (₹)" value={p.amount} onChange={(n) => set("rechargePacks", s.rechargePacks.map((x, k) => (k === i ? { ...x, amount: n } : x)))} />
            <Num label="Bonus (₹)" value={p.bonus} onChange={(n) => set("rechargePacks", s.rechargePacks.map((x, k) => (k === i ? { ...x, bonus: n } : x)))} />
            <Field label="Tag"><AdminSelect value={p.tag ?? ""} onChange={(e) => set("rechargePacks", s.rechargePacks.map((x, k) => (k === i ? { ...x, tag: e.target.value as "" | "Popular" | "Best value" } : x)))}><option value="">None</option><option value="Popular">Popular</option><option value="Best value">Best value</option></AdminSelect></Field>
            <button type="button" aria-label="Remove pack" disabled={s.rechargePacks.length <= 1} onClick={() => set("rechargePacks", s.rechargePacks.filter((_, k) => k !== i))} className="mb-1 rounded-md p-2 text-rose-600 hover:bg-rose-500/10 disabled:opacity-30"><Trash2 size={16} /></button>
          </div>
        ))}
      </Card>
    </div>
  );
}
