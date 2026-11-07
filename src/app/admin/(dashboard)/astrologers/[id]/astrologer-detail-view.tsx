"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, ExternalLink, PowerOff, Trash2, Check, X } from "lucide-react";
import type { AstroBadge, AstrologerStatus, KycDocType } from "@/modules/astrologers/astrologer.types";
import { ASTRO_BADGES, KYC_DOC_TYPES } from "@/modules/astrologers/astrologer.types";
import { astroAdminApi, type AdminAstrologer } from "@/lib/admin-astro-api";
import {
  AdminBreadcrumb, AdminButton, AdminInput, AdminTextarea, Avatar, Card, ConfirmDialog, EmptyState, Field, KeyValueList, Modal, StatsSkeleton,
  StatusPill, Tabs, Toggle, useAdminToast, useOnMount,
} from "../../../_components";
import { A_NEXT, A_STATUS, KYC_NAMES, KYC_TONE } from "../astro-meta";

type Tab = "overview" | "kyc" | "edits" | "program" | "activity";
const BADGE_LABEL: Record<AstroBadge, string> = { vip: "VIP", trending: "Trending", topRated: "Top rated", rising: "Rising star", mostBooked: "Most booked" };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AstrologerDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [a, setA] = useState<AdminAstrologer | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [statusAsk, setStatusAsk] = useState<{ to: AstrologerStatus; label: string; needsReason?: boolean; danger?: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [kycAsk, setKycAsk] = useState<{ type: KycDocType; status: "verified" | "rejected" } | null>(null);
  const [kycNote, setKycNote] = useState("");
  const [note, setNote] = useState("");
  const [askRemove, setAskRemove] = useState(false);
  const [askOffline, setAskOffline] = useState(false);
  const [payout, setPayout] = useState<Awaited<ReturnType<typeof astroAdminApi.astrologers.payoutDestination>> | null>(null);
  const [program, setProgram] = useState<{ commissionPct: string; maxRate: string; featured: boolean; sortWeight: string; badges: AstroBadge[]; hidden: boolean; adminNotes: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await astroAdminApi.astrologers.get(id);
    if (res.ok) {
      setA(res.data);
      setProgram({ commissionPct: res.data.commissionPct == null ? "" : String(res.data.commissionPct), maxRate: res.data.maxRate == null ? "" : String(res.data.maxRate), featured: res.data.featured, sortWeight: String(res.data.sortWeight), badges: res.data.badges, hidden: res.data.hidden, adminNotes: res.data.adminNotes ?? "" });
    } else toast(res.message, "error");
    setLoading(false);
  };
  useOnMount(load);
  const refresh = async () => { const r = await astroAdminApi.astrologers.get(id); if (r.ok) setA(r.data); };

  if (loading) return <StatsSkeleton count={3} />;
  if (!a || !program) return <EmptyState title="Astrologer not found" message="It may have been removed." />;

  const runStatus = async () => {
    if (!statusAsk) return;
    const res = await astroAdminApi.astrologers.setStatus(a.id, statusAsk.to, reason || undefined);
    if (!res.ok) { toast(res.message, "error"); return; }
    toast(`${a.displayName} → ${A_STATUS[statusAsk.to].label}`, "success");
    setStatusAsk(null); setReason("");
    await refresh();
  };
  const runKyc = async () => {
    if (!kycAsk) return;
    const res = await astroAdminApi.astrologers.reviewKyc(a.id, kycAsk.type, kycAsk.status, kycNote || undefined);
    if (!res.ok) { toast(res.message, "error"); return; }
    toast(`${KYC_NAMES[kycAsk.type]} ${kycAsk.status}`, "success");
    setKycAsk(null); setKycNote("");
    await refresh();
  };
  const openFile = async (type: KycDocType) => {
    // Open the tab synchronously (inside the click) so popup blockers allow it,
    // then point it at the short-lived signed URL once we have it.
    const w = window.open("about:blank", "_blank");
    if (w) w.opener = null;
    const res = await astroAdminApi.astrologers.kycFile(a.id, type);
    if (!res.ok) { w?.close(); toast(res.message, "error"); return; }
    if (w) w.location.href = res.data.url; else toast("Allow pop-ups to view the file", "error");
  };
  const saveProgram = async () => {
    const res = await astroAdminApi.astrologers.update(a.id, {
      commissionPct: program.commissionPct === "" ? null : Number(program.commissionPct),
      maxRate: program.maxRate === "" ? null : Number(program.maxRate),
      featured: program.featured, sortWeight: Number(program.sortWeight) || 0, badges: program.badges, hidden: program.hidden, adminNotes: program.adminNotes,
    });
    if (!res.ok) { toast(res.message, "error"); return; }
    toast("Saved", "success");
    await refresh();
  };
  const reviewEdits = async (approve: boolean) => {
    const res = await astroAdminApi.astrologers.reviewPending(a.id, approve);
    if (!res.ok) { toast(res.message, "error"); return; }
    toast(approve ? "Profile changes are live" : "Profile changes rejected", "success");
    await refresh();
  };
  const addNote = async () => {
    if (!note.trim()) return;
    const res = await astroAdminApi.astrologers.addNote(a.id, note.trim());
    if (res.ok) { setNote(""); await refresh(); } else toast(res.message, "error");
  };
  const revealPayout = async () => setPayout(await astroAdminApi.astrologers.payoutDestination(a.id));

  const pc = a.pendingChanges;

  return (
    <div className="space-y-6">
      <AdminBreadcrumb items={[{ label: "Astrologers", href: "/admin/astrologers" }, { label: a.displayName }]} />

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative"><Avatar name={a.displayName} src={a.photo} size={64} />{a.presence.online && <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold" style={{ color: "var(--a-fg)" }}>{a.displayName}</h1>
              <StatusPill tone={A_STATUS[a.status].tone}>{A_STATUS[a.status].label}</StatusPill>
              {a.kycComplete && <StatusPill tone="green">KYC verified</StatusPill>}
              {a.presence.online && <StatusPill tone="green">{a.presence.busyWith ? "Busy in session" : "Online"}</StatusPill>}
              {a.hidden && <StatusPill tone="muted">Hidden</StatusPill>}
            </div>
            <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>{a.legalName} · {a.email} · {a.phone} · {a.source === "invite" ? "Invited" : "Self-applied"} {new Date(a.appliedAt).toLocaleDateString("en-IN")}</p>
            {a.statusReason && <p className="mt-1 text-sm text-rose-700">Reason: {a.statusReason}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {a.status === "approved" && <a href={`/astrologers/${a.slug}`} target="_blank" rel="noopener noreferrer"><AdminButton variant="outline"><ExternalLink size={15} />Public profile</AdminButton></a>}
            {A_NEXT[a.status].map((n) => <AdminButton key={n.to} variant={n.danger ? "danger" : "primary"} onClick={() => { setReason(""); setStatusAsk(n); }}>{n.label}</AdminButton>)}
          </div>
        </div>
      </Card>

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { value: "overview", label: "Overview" },
        { value: "kyc", label: "KYC & payout", count: a.kyc.filter((d) => d.status === "pending").length || undefined },
        { value: "edits", label: "Profile edits", count: pc ? 1 : undefined },
        { value: "program", label: "Commission & visibility" },
        { value: "activity", label: "Activity", count: a.activity.length },
      ]} />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Profile</p>
            {a.shortBio && <p className="mt-2 text-sm font-medium" style={{ color: "var(--a-fg)" }}>{a.shortBio}</p>}
            {a.bio && <p className="mt-2 whitespace-pre-line text-sm" style={{ color: "var(--a-muted)" }}>{a.bio}</p>}
            <div className="mt-4">
              <KeyValueList items={[
                { label: "Experience", value: `${a.experienceYears} years` },
                { label: "Languages", value: a.languages.join(", ") || "–" },
                { label: "Skills", value: a.expertise.join(", ") || "–" },
                { label: "Topics", value: a.categories.join(", ") || "–" },
                { label: "Location", value: [a.city, a.state].filter(Boolean).join(", ") || "–" },
                { label: "Education", value: a.education || "–" },
                { label: "Certifications", value: a.certifications || "–" },
              ]} />
            </div>
          </Card>
          <div className="space-y-6">
            <Card className="p-5">
              <p className="mb-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Rates & numbers</p>
              <KeyValueList items={[
                { label: "Chat", value: a.rates.chat ? `₹${a.rates.chat}/min` : "Off" },
                { label: "Call", value: a.rates.call ? `₹${a.rates.call}/min` : "Off" },
                { label: "Video", value: a.rates.video ? `₹${a.rates.video}/min` : "Off" },
                { label: "Commission", value: `${a.effectiveCommissionPct}%${a.commissionPct == null ? " (default)" : ""}` },
                { label: "Rating", value: a.stats.reviewCount ? `${a.stats.rating.toFixed(1)} · ${a.stats.reviewCount} reviews` : "No reviews" },
                { label: "Sessions / minutes", value: `${a.stats.totalSessions} / ${a.stats.totalMinutes}` },
                { label: "Missed requests", value: a.stats.missedRequests },
                { label: "Last sign-in", value: a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString("en-IN") : "Never" },
              ]} />
            </Card>
            <Card className="p-5">
              <p className="mb-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Availability</p>
              {a.availability.length ? DAYS.map((d, i) => {
                const s = a.availability.filter((x) => x.day === i);
                return s.length ? <p key={d} className="text-sm" style={{ color: "var(--a-fg)" }}><span className="inline-block w-10 font-medium">{d}</span>{s.map((x) => `${x.start}-${x.end}`).join(", ")}</p> : null;
              }) : <p className="text-sm" style={{ color: "var(--a-muted)" }}>Not set</p>}
            </Card>
          </div>
        </div>
      )}

      {tab === "kyc" && (
        <div className="space-y-6">
          <Card className="divide-y px-5" style={{ borderColor: "var(--a-border)" }}>
            {KYC_DOC_TYPES.map((t) => {
              const d = a.kyc.find((x) => x.type === t);
              return (
                <div key={t} className="flex flex-wrap items-center gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{KYC_NAMES[t]}</p>{d ? <StatusPill tone={KYC_TONE[d.status]}>{d.status}</StatusPill> : <StatusPill tone="muted">Not submitted</StatusPill>}</div>
                    {d && <p className="mt-1 text-xs" style={{ color: "var(--a-muted)" }}>{d.numberMasked ? <span className="font-mono">{d.numberMasked} · </span> : null}Uploaded {new Date(d.uploadedAt).toLocaleString("en-IN")}{d.reviewedBy ? ` · reviewed by ${d.reviewedBy}` : ""}{d.note ? ` · ${d.note}` : ""}</p>}
                  </div>
                  {d?.fileKey && <AdminButton variant="outline" onClick={() => openFile(t)}><Eye size={15} />View file</AdminButton>}
                  {d && d.status !== "verified" && <AdminButton onClick={() => { setKycNote(""); setKycAsk({ type: t, status: "verified" }); }}><Check size={15} />Verify</AdminButton>}
                  {d && d.status !== "rejected" && <AdminButton variant="danger" onClick={() => { setKycNote(""); setKycAsk({ type: t, status: "rejected" }); }}><X size={15} />Reject</AdminButton>}
                </div>
              );
            })}
          </Card>
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Payout account</p>
                {a.payout ? <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>{a.payout.accountHolder} · {a.payout.method === "bank" ? `${a.payout.bankName} ${a.payout.accountNumberMasked} (${a.payout.ifsc})` : a.payout.upiId} <StatusPill tone={a.payout.verified ? "green" : "gold"}>{a.payout.verified ? "Verified" : "Not verified"}</StatusPill></p> : <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>Not added yet</p>}
              </div>
              {a.payout && <AdminButton variant="outline" onClick={revealPayout}><Eye size={15} />Reveal full details</AdminButton>}
            </div>
            {payout && (payout.ok
              ? <div className="mt-3 rounded-lg border p-3 font-mono text-sm" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>{payout.data.method === "bank" ? `A/C ${payout.data.accountNumber ?? "–"} · IFSC ${payout.data.ifsc}` : `UPI ${payout.data.upiId}`}{payout.data.pan ? ` · PAN ${payout.data.pan}` : ""}<p className="mt-1 font-sans text-xs" style={{ color: "var(--a-muted)" }}>Viewing is recorded in the activity log.</p></div>
              : <p className="mt-3 text-sm text-rose-600">{payout.message}</p>)}
          </Card>
        </div>
      )}

      {tab === "edits" && (pc ? (
        <Card className="space-y-4 p-5">
          <p className="text-sm" style={{ color: "var(--a-muted)" }}>Submitted {new Date(pc.submittedAt).toLocaleString("en-IN")}. Customers still see the current version.</p>
          {(["displayName", "photo", "shortBio", "bio"] as const).filter((k) => pc[k] !== undefined).map((k) => (
            <div key={k} className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-xs font-semibold uppercase" style={{ color: "var(--a-faint)" }}>Current {k}</p>{k === "photo" ? <Avatar name={a.displayName} src={a.photo} size={72} /> : <p className="whitespace-pre-line text-sm" style={{ color: "var(--a-fg)" }}>{a[k] || "–"}</p>}</div>
              <div><p className="text-xs font-semibold uppercase" style={{ color: "var(--a-gold)" }}>New {k}</p>{k === "photo" ? <Avatar name={a.displayName} src={pc.photo || undefined} size={72} /> : <p className="whitespace-pre-line text-sm" style={{ color: "var(--a-fg)" }}>{pc[k] || "(cleared)"}</p>}</div>
            </div>
          ))}
          <div className="flex gap-2"><AdminButton onClick={() => reviewEdits(true)}>Approve changes</AdminButton><AdminButton variant="danger" onClick={() => reviewEdits(false)}>Reject</AdminButton></div>
        </Card>
      ) : <EmptyState title="No pending edits" message="When an approved astrologer edits their name, photo or bio it appears here." />)}

      {tab === "program" && (
        <Card className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Commission override (%)" hint="Empty = program default"><AdminInput inputMode="decimal" value={program.commissionPct} onChange={(e) => setProgram({ ...program, commissionPct: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) })} /></Field>
            <Field label="Max rate (₹/min)" hint="Empty = program default"><AdminInput inputMode="numeric" value={program.maxRate} onChange={(e) => setProgram({ ...program, maxRate: e.target.value.replace(/\D/g, "").slice(0, 5) })} /></Field>
            <Field label="Sort weight" hint="Higher shows earlier"><AdminInput inputMode="numeric" value={program.sortWeight} onChange={(e) => setProgram({ ...program, sortWeight: e.target.value.replace(/[^\d-]/g, "").slice(0, 5) })} /></Field>
          </div>
          <div className="flex flex-wrap gap-6">
            <Toggle checked={program.featured} onChange={(v) => setProgram({ ...program, featured: v })} label="Featured" />
            <Toggle checked={program.hidden} onChange={(v) => setProgram({ ...program, hidden: v })} label="Hide from customers" />
          </div>
          <Field label="Badges">
            <div className="flex flex-wrap gap-2">
              {ASTRO_BADGES.map((b) => {
                const on = program.badges.includes(b);
                return <button key={b} type="button" aria-pressed={on} onClick={() => setProgram({ ...program, badges: on ? program.badges.filter((x) => x !== b) : [...program.badges, b] })} className="rounded-full border px-3 py-1.5 text-sm font-medium" style={{ borderColor: on ? "var(--a-gold)" : "var(--a-border)", color: on ? "var(--a-gold)" : "var(--a-muted)", background: on ? "var(--a-gold-soft)" : "transparent" }}>{BADGE_LABEL[b]}</button>;
              })}
            </div>
          </Field>
          <Field label="Internal notes (never shown to the astrologer)"><AdminTextarea rows={4} value={program.adminNotes} onChange={(e) => setProgram({ ...program, adminNotes: e.target.value.slice(0, 4000) })} /></Field>
          <div className="flex flex-wrap justify-between gap-3">
            <AdminButton onClick={saveProgram}>Save</AdminButton>
            <div className="flex gap-2">
              {a.presence.online && <AdminButton variant="outline" onClick={() => setAskOffline(true)}><PowerOff size={15} />Force offline</AdminButton>}
              <AdminButton variant="danger" onClick={() => setAskRemove(true)}><Trash2 size={15} />Remove</AdminButton>
            </div>
          </div>
        </Card>
      )}

      {tab === "activity" && (
        <Card className="p-5">
          <div className="mb-4 flex gap-2"><AdminInput value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} placeholder="Add an internal note…" onKeyDown={(e) => { if (e.key === "Enter") void addNote(); }} /><AdminButton onClick={addNote}>Add</AdminButton></div>
          <ul className="space-y-3">
            {a.activity.map((e) => (
              <li key={e.id} className="border-l-2 pl-3" style={{ borderColor: "var(--a-gold-soft)" }}>
                <p className="text-sm" style={{ color: "var(--a-fg)" }}>{e.message}</p>
                <p className="text-xs" style={{ color: "var(--a-faint)" }}>{new Date(e.at).toLocaleString("en-IN")} · {e.actor ?? "System"} · {e.type}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={!!statusAsk} onClose={() => setStatusAsk(null)} title={statusAsk ? `${statusAsk.label} ${a.displayName}?` : ""} subtitle={statusAsk?.needsReason ? "The astrologer sees this reason." : undefined} size="sm">
        <div className="space-y-4">
          <Field label={statusAsk?.needsReason ? "Reason (required)" : "Note (optional)"}><AdminTextarea rows={3} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} /></Field>
          {statusAsk?.to === "suspended" && <p className="text-xs" style={{ color: "var(--a-muted)" }}>Suspending signs them out everywhere, sets them offline and ends any live session.</p>}
          <AdminButton className="w-full" variant={statusAsk?.danger ? "danger" : "primary"} disabled={!!statusAsk?.needsReason && reason.trim().length < 5} onClick={runStatus}>Confirm</AdminButton>
        </div>
      </Modal>
      <Modal open={!!kycAsk} onClose={() => setKycAsk(null)} title={kycAsk ? `${kycAsk.status === "verified" ? "Verify" : "Reject"} ${KYC_NAMES[kycAsk.type]}` : ""} size="sm">
        <div className="space-y-4">
          <Field label={kycAsk?.status === "rejected" ? "Reason (sent to the astrologer)" : "Note (optional)"}><AdminTextarea rows={3} value={kycNote} onChange={(e) => setKycNote(e.target.value.slice(0, 500))} /></Field>
          <AdminButton className="w-full" variant={kycAsk?.status === "rejected" ? "danger" : "primary"} disabled={kycAsk?.status === "rejected" && kycNote.trim().length < 3} onClick={runKyc}>Confirm</AdminButton>
        </div>
      </Modal>
      <ConfirmDialog open={askOffline} onClose={() => setAskOffline(false)} onConfirm={async () => { const r = await astroAdminApi.astrologers.forceOffline(a.id, "Set offline by admin"); if (r.ok) { toast("Set offline", "success"); await refresh(); } else toast(r.message, "error"); }} title="Force offline?" message="New requests stop immediately. A live session (if any) continues." confirmLabel="Set offline" />
      <ConfirmDialog open={askRemove} onClose={() => setAskRemove(false)} onConfirm={async () => { const r = await astroAdminApi.astrologers.remove(a.id); if (r.ok) { toast("Astrologer removed", "success"); router.replace("/admin/astrologers"); } else toast(r.message, "error"); }} title="Remove this astrologer?" message="They are signed out and hidden. History (sessions, payouts) is kept." confirmLabel="Remove" danger />
    </div>
  );
}
