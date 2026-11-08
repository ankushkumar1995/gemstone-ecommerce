"use client";

/**
 * Refer an astrologer (DEMO tracking). Your code and link, invite by mobile or
 * email, and a tracker for every referral.
 *
 * Programme rules:
 *   • you get ₹1,000 when your referral is approved AND completes 50 paid
 *     sessions within 60 days of approval; they pay no platform fee on their
 *     first ₹2,000 of earnings
 *   • no self-referrals: same PAN, mobile, bank account or device is rejected
 *   • up to 10 invites a day and 20 paid referrals a year
 *   • the same person can be invited once; the first valid invite wins
 *   • bonus follows the normal hold period and is reversed for fraud
 */

import { useMemo, useState } from "react";
import { CheckCircle2, Copy, Gift, MessageCircle, Send, Share2, Users, XCircle } from "lucide-react";
import { AdminButton, AdminInput, Badge, Card, Field, PageHeader, ProgressBar, StatCard, StatsSkeleton, useAdminToast, useOnMount } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { DemoBanner, fmtDateTime, inr, nowMs } from "../../_components/demo";
import { referralsStore, useStore, type Referral } from "../../_components/demo-store";

const BONUS = 1000;
const TARGET = 50;
const WINDOW_DAYS = 60;
const DAILY_LIMIT = 10;
const YEAR_CAP = 20;
const D = 86400000;

const STAGES: Referral["stage"][] = ["invited", "applied", "kyc", "approved", "qualifying", "paid"];
const STAGE_LABEL: Record<Referral["stage"], string> = { invited: "Invited", applied: "Applied", kyc: "KYC submitted", approved: "Approved", qualifying: "Doing sessions", paid: "Bonus paid", expired: "Expired", rejected: "Not eligible" };

function seed(t: number): Referral[] {
  return [
    { id: "rf1", name: "Pandit Suresh Sharma", contact: "••••••4410", invitedAt: new Date(t - 70 * D).toISOString(), stage: "paid", sessions: 50 },
    { id: "rf2", name: "Acharya Meera", contact: "m•••@gmail.com", invitedAt: new Date(t - 25 * D).toISOString(), stage: "qualifying", sessions: 31 },
    { id: "rf3", name: "Tarot Neha", contact: "••••••2298", invitedAt: new Date(t - 9 * D).toISOString(), stage: "kyc", sessions: 0 },
    { id: "rf4", name: "Ravi Joshi", contact: "••••••7781", invitedAt: new Date(t - 3 * D).toISOString(), stage: "invited", sessions: 0 },
    { id: "rf5", name: "Guru Prakash", contact: "••••••0912", invitedAt: new Date(t - 95 * D).toISOString(), stage: "expired", sessions: 18, note: "Completed 18 of 50 sessions in 60 days" },
    { id: "rf6", name: "K. Verma", contact: "••••••5530", invitedAt: new Date(t - 40 * D).toISOString(), stage: "rejected", sessions: 0, note: "Same bank account as an existing partner" },
  ];
}

export default function ReferralPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const stored = useStore(referralsStore);
  const [now, setNow] = useState(0);
  const [contact, setContact] = useState("");
  const [name, setName] = useState("");
  useOnMount(() => { const t = nowMs(); setNow(t); if (referralsStore.get() === null) referralsStore.set(seed(t)); });

  const list = useMemo(() => stored ?? [], [stored]);
  if (loading || !me || !now || stored === null) return <StatsSkeleton count={4} />;

  const code = `AU-${me.slug.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase()}`;
  const link = `https://astrounkle.com/astrologer/apply?ref=${code}`;
  const paid = list.filter((r) => r.stage === "paid");
  const active = list.filter((r) => !["paid", "expired", "rejected"].includes(r.stage));
  const today = list.filter((r) => now - Date.parse(r.invitedAt) < D).length;
  const yearPaid = paid.filter((r) => now - Date.parse(r.invitedAt) < 365 * D).length;
  const pending = list.filter((r) => r.stage === "qualifying").length * BONUS;

  const digits = contact.replace(/\D/g, "");
  const isPhone = !contact.includes("@") && /^[6-9]\d{9}$/.test(digits.slice(-10)) && (digits.length === 10 || (digits.length === 12 && digits.startsWith("91")));
  const isEmail = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(contact.trim());
  const ownContact = contact.replace(/\D/g, "").slice(-10) === me.phone.replace(/\D/g, "").slice(-10) || contact.trim().toLowerCase() === me.email.toLowerCase();

  const invite = () => {
    if (!isPhone && !isEmail) return toast("Enter a valid 10-digit mobile or an email", "error");
    if (name.trim().length < 2) return toast("Enter their name", "error");
    if (ownContact) return toast("You cannot refer yourself", "error");
    if (today >= DAILY_LIMIT) return toast(`Daily limit of ${DAILY_LIMIT} invites reached. Try tomorrow.`, "error");
    if (yearPaid >= YEAR_CAP) return toast(`You reached the yearly cap of ${YEAR_CAP} paid referrals. Thank you.`, "error");
    const masked = isEmail ? `${contact.trim()[0]}•••@${contact.trim().split("@")[1]}` : `••••••${contact.replace(/\D/g, "").slice(-4)}`;
    if (list.some((r) => r.contact === masked)) return toast("This person was already invited", "error");
    referralsStore.set((l) => [{ id: `rf_${nowMs()}`, name: name.trim().slice(0, 60), contact: masked, invitedAt: new Date(nowMs()).toISOString(), stage: "invited", sessions: 0 }, ...(l ?? [])]);
    setContact("");
    setName("");
    toast("Invite sent with your link", "success");
  };

  const copy = (t: string) => { void navigator.clipboard?.writeText(t); toast("Copied", "success"); };
  const waText = encodeURIComponent(`Namaste! Main Astrounkle par consultations deta hoon. Aap bhi partner astrologer ban sakte hain. Mera code ${code} use karein: ${link}`);

  return (
    <div className="space-y-6">
      <PageHeader title="Refer an astrologer" subtitle={`Earn ${inr(BONUS)} for every partner you bring who does well`} />
      <DemoBanner what="Referral tracking" />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Users} value={list.length} label="Invited" tone="royal" />
        <StatCard icon={CheckCircle2} value={active.length} label="In progress" tone="blue" />
        <StatCard icon={Gift} value={inr(paid.length * BONUS)} label="Bonus earned" tone="green" />
        <StatCard icon={Gift} value={inr(pending)} label="Possible soon" tone="gold" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Share2 size={16} /> Your code and link</p>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: "var(--a-gold-soft)" }}>
            <span className="flex-1 font-mono text-lg font-semibold tracking-wider" style={{ color: "var(--a-gold)" }}>{code}</span>
            <button type="button" aria-label="Copy code" onClick={() => copy(code)} style={{ color: "var(--a-gold)" }}><Copy size={16} /></button>
          </div>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--a-surface-2)", color: "var(--a-fg)" }}>
            <span className="min-w-0 flex-1 truncate">{link}</span>
            <button type="button" aria-label="Copy link" onClick={() => copy(link)}><Copy size={15} /></button>
          </div>
          <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer"><AdminButton variant="outline"><MessageCircle size={15} /> Share on WhatsApp</AdminButton></a>
        </Card>

        <Card className="space-y-3 p-5">
          <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Send size={16} /> Invite directly</p>
          <Field label="Their name"><AdminInput value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} /></Field>
          <Field label="Mobile or email" hint="We send one invite with your code. We never message them again unless they apply.">
            <AdminInput value={contact} onChange={(e) => setContact(e.target.value.slice(0, 80))} placeholder="98xxxxxx10 or name@email.com" />
          </Field>
          <AdminButton onClick={invite} disabled={!contact.trim() || !name.trim()}>Send invite</AdminButton>
          <p className="text-xs" style={{ color: "var(--a-faint)" }}>{today}/{DAILY_LIMIT} invites today · {yearPaid}/{YEAR_CAP} paid referrals this year</p>
        </Card>
      </div>

      <Card className="p-5">
        <p className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Your referrals</p>
        <ul className="space-y-3">
          {list.map((r) => {
            const idx = STAGES.indexOf(r.stage);
            const ended = r.stage === "expired" || r.stage === "rejected";
            const daysLeft = r.stage === "qualifying" ? Math.max(0, WINDOW_DAYS - Math.floor((now - Date.parse(r.invitedAt)) / D) + 5) : null;
            return (
              <li key={r.id} className="rounded-lg border p-4" style={{ borderColor: "var(--a-border)" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium" style={{ color: "var(--a-fg)" }}>{r.name}</p>
                  <span className="text-xs" style={{ color: "var(--a-muted)" }}>{r.contact} · invited {fmtDateTime(r.invitedAt)}</span>
                  <span className="ml-auto"><Badge tone={r.stage === "paid" ? "green" : ended ? "rose" : "gold"}>{STAGE_LABEL[r.stage]}</Badge></span>
                </div>
                {!ended && (
                  <ol className="mt-3 grid grid-cols-6 gap-1" aria-label="Progress">
                    {STAGES.map((s, i) => <li key={s} title={STAGE_LABEL[s]} className="h-1.5 rounded-full" style={{ background: i <= idx ? "var(--a-gold)" : "var(--a-surface-2)" }} />)}
                  </ol>
                )}
                {r.stage === "qualifying" && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs" style={{ color: "var(--a-muted)" }}><span>{r.sessions}/{TARGET} paid sessions</span><span>{daysLeft} days left</span></div>
                    <ProgressBar value={(r.sessions / TARGET) * 100} tone="gold" />
                  </div>
                )}
                {r.note && <p className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: ended ? "#be123c" : "var(--a-muted)" }}>{ended && <XCircle size={13} />}{r.note}</p>}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="p-5 text-sm">
        <p className="mb-2 font-semibold" style={{ color: "var(--a-fg)" }}>How it works</p>
        <ul className="list-disc space-y-1 pl-5" style={{ color: "var(--a-muted)" }}>
          <li>They apply with your link or code. If they used someone else&apos;s code first, that invite counts.</li>
          <li>You get {inr(BONUS)} when they are approved and finish {TARGET} paid sessions within {WINDOW_DAYS} days of approval.</li>
          <li>They pay no platform fee on their first {inr(2000)} of earnings.</li>
          <li>Self-referrals (same PAN, mobile, bank account or device) and fake sessions are not eligible and can lead to a strike.</li>
          <li>The bonus is added to your earnings and follows the normal hold period.</li>
        </ul>
      </Card>
    </div>
  );
}
