"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { AstroProgramSettings } from "@/modules/astro-settings/astro-settings";
import { astroAdminApi } from "@/lib/admin-astro-api";
import { AdminBreadcrumb, AdminButton, AdminInput, AdminSelect, AdminTextarea, Card, Field, PageHeader, StatsSkeleton, Toggle, useAdminToast, useOnMount } from "../../../_components";

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
          <div className="space-y-2">
            <Toggle checked={s.tds.enabled} onChange={(v) => set("tds", { ...s.tds, enabled: v })} label="Deduct TDS on payouts" />
            <div className="grid grid-cols-2 gap-3">
              <Num label="TDS with PAN (%)" value={s.tds.ratePct} step={0.5} onChange={(n) => set("tds", { ...s.tds, ratePct: n })} />
              <Num label="TDS without PAN (%)" value={s.tds.noPanRatePct} step={0.5} onChange={(n) => set("tds", { ...s.tds, noPanRatePct: n })} />
            </div>
          </div>
        </div>
        <p className="text-xs" style={{ color: "var(--a-muted)" }}>Confirm GST and TDS treatment with your chartered accountant before turning these on. TDS is taken at the moment a payout is requested and shown to the partner.</p>
        <div className="border-t pt-4" style={{ borderColor: "var(--a-border)" }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-muted)" }}>How payouts are sent</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Provider" hint="RazorpayX needs its keys and account number on the server">
              <AdminSelect value={s.payouts.provider} onChange={(e) => set("payouts", { ...s.payouts, provider: e.target.value as S["payouts"]["provider"] })}>
                <option value="manual">Manual (bank transfer + UTR)</option>
                <option value="razorpayx">RazorpayX (automatic)</option>
              </AdminSelect>
            </Field>
            <Field label="Weekly cycle day">
              <AdminSelect value={String(s.payouts.cycleWeekday)} onChange={(e) => set("payouts", { ...s.payouts, cycleWeekday: Number(e.target.value) })}>
                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => <option key={d} value={i}>{d}</option>)}
              </AdminSelect>
            </Field>
            <Num label="Most per payout (₹, 0 = no limit)" value={s.payouts.maxPerRequest} onChange={(n) => set("payouts", { ...s.payouts, maxPerRequest: n })} />
          </div>
          <div className="mt-3 flex flex-wrap gap-6">
            <Toggle checked={s.payouts.autoCreate} onChange={(v) => set("payouts", { ...s.payouts, autoCreate: v })} label="Create payouts automatically on the cycle day" />
            <Toggle checked={s.payouts.requireVerifiedAccount} onChange={(v) => set("payouts", { ...s.payouts, requireVerifiedAccount: v })} label="Pay only to verified accounts" />
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Tips after a chat</p>
          <Toggle checked={s.tips.enabled} onChange={(v) => set("tips", { ...s.tips, enabled: v })} label="Customers can tip" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Quick amounts (₹)" hint="Comma separated, up to 6">
            <AdminInput value={s.tips.presets.join(", ")} onChange={(e) => set("tips", { ...s.tips, presets: e.target.value.split(",").map((x) => Math.floor(Number(x.trim()))).filter((n) => Number.isFinite(n) && n > 0).slice(0, 6) })} />
          </Field>
          <Num label="Most per chat (₹)" value={s.tips.maxPerChat} onChange={(n) => set("tips", { ...s.tips, maxPerChat: n })} />
          <Num label="Tip window (hours after the chat)" value={s.tips.windowHours} onChange={(n) => set("tips", { ...s.tips, windowHours: n })} />
        </div>
        <p className="text-xs" style={{ color: "var(--a-muted)" }}>Tips go 100% to the astrologer (no commission) and follow the same hold period.</p>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Waitlist</p>
          <Toggle checked={s.waitlist.enabled} onChange={(v) => set("waitlist", { ...s.waitlist, enabled: v })} label="Customers can wait for a busy astrologer" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Num label="Most people waiting" value={s.waitlist.maxSize} onChange={(n) => set("waitlist", { ...s.waitlist, maxSize: n })} />
          <Num label="Seconds to take a turn" value={s.waitlist.offerSec} onChange={(n) => set("waitlist", { ...s.waitlist, offerSec: n })} />
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Live sessions</p>
          <Toggle checked={s.live.enabled} onChange={(v) => set("live", { ...s.live, enabled: v })} label="Astrologers can go live" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Num label="Time limit (minutes)" hint="A live ends by itself after this" value={s.live.maxMinutes} onChange={(n) => set("live", { ...s.live, maxMinutes: n })} />
          <Num label="Default slow mode (sec)" hint="Between two comments from one viewer" value={s.live.slowSec} onChange={(n) => set("live", { ...s.live, slowSec: n })} />
          <Num label="Most questions waiting" value={s.live.maxQueue} onChange={(n) => set("live", { ...s.live, maxQueue: n })} />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-muted)" }}>Gifts (paid from the wallet, commission applies)</p>
          <AdminButton variant="outline" onClick={() => set("live", { ...s.live, gifts: [...s.live.gifts, { id: `gift-${s.live.gifts.length + 1}`, name: "New gift", emoji: "🎁", price: 10 }] })} disabled={s.live.gifts.length >= 12}><Plus size={15} />Add gift</AdminButton>
        </div>
        {s.live.gifts.map((g, i) => {
          const upd = (patch: Partial<typeof g>) => set("live", { ...s.live, gifts: s.live.gifts.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
          return (
            <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_80px_1fr_auto]">
              <Field label="Id" hint="Lowercase, no spaces"><AdminInput value={g.id} onChange={(e) => upd({ id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} /></Field>
              <Field label="Name"><AdminInput value={g.name} maxLength={30} onChange={(e) => upd({ name: e.target.value })} /></Field>
              <Field label="Emoji"><AdminInput value={g.emoji} maxLength={8} onChange={(e) => upd({ emoji: e.target.value })} /></Field>
              <Num label="Price (₹)" value={g.price} onChange={(n) => upd({ price: n })} />
              <button type="button" aria-label="Remove gift" onClick={() => set("live", { ...s.live, gifts: s.live.gifts.filter((_, k) => k !== i) })} className="mb-1 rounded-md p-2 text-rose-600 hover:bg-rose-500/10"><Trash2 size={16} /></button>
            </div>
          );
        })}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Gift combos" hint="Comma separated, up to 4 (1 = single gift)">
            <AdminInput value={s.live.giftCombos.join(", ")} onChange={(e) => set("live", { ...s.live, giftCombos: [...new Set(e.target.value.split(",").map((x) => Math.floor(Number(x.trim()))).filter((n) => Number.isFinite(n) && n >= 1 && n <= 100))].slice(0, 4) })} />
          </Field>
          <Num label="Full-screen animation from (₹)" hint="Gift price × combo" value={s.live.bigGiftAt} onChange={(n) => set("live", { ...s.live, bigGiftAt: n })} />
        </div>
        <div className="border-t pt-4" style={{ borderColor: "var(--a-border)" }}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-muted)" }}>Super Chat (paid priority question)</p>
            <Toggle checked={s.live.superChat.enabled} onChange={(v) => set("live", { ...s.live, superChat: { ...s.live.superChat, enabled: v } })} label="Viewers can pay to jump the line" />
          </div>
          {s.live.superChat.tiers.map((t, i) => {
            const upd = (patch: Partial<typeof t>) => set("live", { ...s.live, superChat: { ...s.live.superChat, tiers: s.live.superChat.tiers.map((x, k) => (k === i ? { ...x, ...patch } : x)) } });
            return (
              <div key={i} className="mb-2 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <Num label="Price (₹)" value={t.price} onChange={(n) => upd({ price: n })} />
                <Num label="Highlight on screen (seconds)" value={t.pinSec} onChange={(n) => upd({ pinSec: n })} />
                <button type="button" aria-label="Remove tier" disabled={s.live.superChat.tiers.length <= 1} onClick={() => set("live", { ...s.live, superChat: { ...s.live.superChat, tiers: s.live.superChat.tiers.filter((_, k) => k !== i) } })} className="mb-1 rounded-md p-2 text-rose-600 hover:bg-rose-500/10 disabled:opacity-30"><Trash2 size={16} /></button>
              </div>
            );
          })}
          <AdminButton variant="outline" onClick={() => set("live", { ...s.live, superChat: { ...s.live.superChat, tiers: [...s.live.superChat.tiers, { price: 501, pinSec: 600 }] } })} disabled={s.live.superChat.tiers.length >= 4}><Plus size={15} />Add tier</AdminButton>
          <p className="mt-2 text-xs" style={{ color: "var(--a-muted)" }}>Higher amounts go first in the line. Kept only when the astrologer answers (platform commission applies). Skipped, muted, left or unanswered when the live ends: refunded to the wallet automatically.</p>
        </div>
        <div className="border-t pt-4" style={{ borderColor: "var(--a-border)" }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-muted)" }}>Comment filter</p>
          <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
            <WordsBox words={s.live.blockedWords} onChange={(w) => set("live", { ...s.live, blockedWords: w })} />
            <Num label="Auto mute after (hidden comments)" hint="In one live. 0 = never" value={s.live.autoMuteStrikes} onChange={(n) => set("live", { ...s.live, autoMuteStrikes: Math.max(0, Math.min(20, n)) })} />
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--a-muted)" }}>Common Hindi, Hinglish and English abuse is already blocked, also when written with tricks (f@ck, ch00t, m a d a r). Add more words here. A caught comment is shown only to the person who wrote it. The same comment again within 2 minutes is refused. Abusive questions and Super Chats are refused before any charge.</p>
        </div>
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

/** Extra filtered words: one per line or comma separated. Keeps the typed text so commas and new lines are not eaten while typing. */
function WordsBox({ words, onChange }: { words: string[]; onChange: (w: string[]) => void }) {
  const [raw, setRaw] = useState(() => words.join("\n"));
  const parse = (v: string) => [...new Set(v.split(/[\n,]/).map((x) => x.trim().toLowerCase()).filter((x) => x.length >= 2 && x.length <= 40))].slice(0, 300);
  return (
    <Field label="Extra blocked words" hint={`${words.length} added · one per line or comma separated`}>
      <AdminTextarea value={raw} rows={4} maxLength={8000} onChange={(e) => { setRaw(e.target.value); onChange(parse(e.target.value)); }}
        placeholder={"word one\nword two"} aria-label="Extra blocked words" />
    </Field>
  );
}
