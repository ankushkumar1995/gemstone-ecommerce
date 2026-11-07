"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, Clock, Radio, Settings2, Sparkles, UserPlus, Users } from "lucide-react";
import type { Astrologer, AstrologerStatus } from "@/modules/astrologers/astrologer.types";
import { REQUIRED_KYC } from "@/modules/astrologers/astrologer.types";
import { astroAdminApi } from "@/lib/admin-astro-api";
import {
  AdminButton, AdminInput, Avatar, CopyButton, DataTable, Field, Modal, PageHeader, StatCard, StatsSkeleton, StatusPill, Tabs, Toggle, useAdminToast, useOnMount, type Column,
} from "../../_components";
import { A_STATUS } from "./astro-meta";

type TabKey = "all" | "review" | "approved" | "online" | "edits" | "blocked";

function InviteModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (a: Astrologer) => void }) {
  const { toast } = useAdminToast();
  const [f, setF] = useState({ displayName: "", legalName: "", email: "", phone: "", experienceYears: "0", approveNow: false });
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);
  const close = () => { setTemp(null); setF({ displayName: "", legalName: "", email: "", phone: "", experienceYears: "0", approveNow: false }); onClose(); };

  const submit = async () => {
    setBusy(true);
    const res = await astroAdminApi.astrologers.invite({ ...f, experienceYears: Number(f.experienceYears) || 0 });
    setBusy(false);
    if (!res.ok) { toast(res.message, "error"); return; }
    setTemp(res.data.tempPassword);
    onDone(res.data.astrologer);
  };

  return (
    <Modal open={open} onClose={close} title="Invite an astrologer" subtitle="They get an email with a temporary password and must change it on first sign-in.">
      {temp ? (
        <div className="space-y-3 text-sm" style={{ color: "var(--a-fg)" }}>
          <p>Invite sent to <b>{f.email}</b>. If email is not configured, share this one-time temporary password securely:</p>
          <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 font-mono" style={{ borderColor: "var(--a-border)" }}>{temp}<CopyButton value={temp} label="Copy" /></div>
          <p className="text-xs" style={{ color: "var(--a-muted)" }}>This password is not shown again.</p>
          <AdminButton onClick={close} className="w-full">Done</AdminButton>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name" required><AdminInput value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></Field>
            <Field label="Legal name" required><AdminInput value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} /></Field>
            <Field label="Email" required><AdminInput type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Mobile" required><AdminInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Years of experience"><AdminInput inputMode="numeric" value={f.experienceYears} onChange={(e) => setF({ ...f, experienceYears: e.target.value.replace(/\D/g, "").slice(0, 2) })} /></Field>
          </div>
          <Toggle checked={f.approveNow} onChange={(v) => setF({ ...f, approveNow: v })} label="Approve immediately (KYC is still required before going online)" />
          <AdminButton onClick={submit} disabled={busy} className="w-full">{busy ? "Sending…" : "Send invite"}</AdminButton>
        </div>
      )}
    </Modal>
  );
}

export function AstrologersManager() {
  const router = useRouter();
  const [rows, setRows] = useState<Astrologer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");
  const [invite, setInvite] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await astroAdminApi.astrologers.list();
    if (res.ok) setRows(res.data);
    setLoading(false);
  };
  useOnMount(load);

  const counts = useMemo(() => ({
    review: rows.filter((a) => a.status === "applied" || a.status === "under_review").length,
    approved: rows.filter((a) => a.status === "approved").length,
    online: rows.filter((a) => a.presence.online).length,
    edits: rows.filter((a) => a.pendingChanges).length,
    blocked: rows.filter((a) => ["suspended", "rejected", "deactivated"].includes(a.status)).length,
  }), [rows]);

  const shown = rows.filter((a) => {
    if (tab === "review") return a.status === "applied" || a.status === "under_review";
    if (tab === "approved") return a.status === "approved";
    if (tab === "online") return a.presence.online;
    if (tab === "edits") return Boolean(a.pendingChanges);
    if (tab === "blocked") return ["suspended", "rejected", "deactivated"].includes(a.status);
    return true;
  });

  const columns: Column<Astrologer>[] = [
    {
      key: "name", header: "Astrologer", searchable: true, sortable: true, accessor: (a) => `${a.displayName} ${a.email} ${a.phone}`,
      cell: (a) => (
        <div className="flex items-center gap-2.5">
          <div className="relative"><Avatar name={a.displayName} src={a.photo} size={36} />{a.presence.online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" aria-label="Online" />}</div>
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{a.displayName}{a.featured && <Sparkles size={13} style={{ color: "var(--a-gold)" }} />}</p>
            <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>{a.email} · {a.phone}</p>
          </div>
        </div>
      ),
    },
    { key: "status", header: "Status", sortable: true, filterable: true, filterOptions: Object.keys(A_STATUS), accessor: (a) => a.status, cell: (a) => <StatusPill tone={A_STATUS[a.status].tone}>{A_STATUS[a.status].label}</StatusPill> },
    {
      key: "kyc", header: "KYC", accessor: (a) => REQUIRED_KYC.filter((t) => a.kyc.find((d) => d.type === t)?.status === "verified").length,
      cell: (a) => {
        const v = REQUIRED_KYC.filter((t) => a.kyc.find((d) => d.type === t)?.status === "verified").length;
        const p = a.kyc.filter((d) => d.status === "pending").length;
        return <span className="text-sm" style={{ color: v === REQUIRED_KYC.length ? "var(--a-green)" : "var(--a-fg)" }}>{v}/{REQUIRED_KYC.length}{p ? <span className="ml-1.5 text-xs" style={{ color: "var(--a-gold)" }}>{p} to check</span> : null}</span>;
      },
    },
    { key: "skills", header: "Skills", searchable: true, accessor: (a) => a.expertise.join(", "), cell: (a) => <span className="line-clamp-1 text-sm" style={{ color: "var(--a-muted)" }}>{a.expertise.slice(0, 3).join(", ") || "–"}</span> },
    { key: "rate", header: "Chat ₹/min", sortable: true, align: "right", accessor: (a) => a.rates.chat, cell: (a) => <span className="font-semibold" style={{ color: "var(--a-fg)" }}>₹{a.rates.chat}</span> },
    { key: "rating", header: "Rating", sortable: true, align: "right", accessor: (a) => a.stats.rating, cell: (a) => <span className="text-sm">{a.stats.reviewCount ? `${a.stats.rating.toFixed(1)} (${a.stats.reviewCount})` : "–"}</span> },
    { key: "sessions", header: "Sessions", sortable: true, align: "right", accessor: (a) => a.stats.totalSessions },
    { key: "applied", header: "Joined", sortable: true, accessor: (a) => a.appliedAt, cell: (a) => <span className="text-sm" style={{ color: "var(--a-muted)" }}>{new Date(a.appliedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</span> },
  ];

  return (
    <div>
      <PageHeader title="Astrologers" subtitle="Applications, KYC, approvals, rates and presence of your partner astrologers."
        action={<div className="flex gap-2"><Link href="/admin/astrologers/settings"><AdminButton variant="outline"><Settings2 size={16} />Program settings</AdminButton></Link><AdminButton onClick={() => setInvite(true)}><UserPlus size={16} />Invite</AdminButton></div>} />
      {loading ? <StatsSkeleton count={4} /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} value={rows.length} label="All astrologers" tone="royal" />
          <StatCard icon={Clock} value={counts.review} label="Waiting for review" tone="gold" />
          <StatCard icon={BadgeCheck} value={counts.approved} label="Approved" tone="green" />
          <StatCard icon={Radio} value={counts.online} label="Online now" tone="blue" />
        </div>
      )}
      <div className="mt-6">
        <Tabs<TabKey>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "all", label: "All", count: rows.length },
            { value: "review", label: "Needs review", count: counts.review },
            { value: "edits", label: "Profile edits", count: counts.edits },
            { value: "approved", label: "Approved", count: counts.approved },
            { value: "online", label: "Online", count: counts.online },
            { value: "blocked", label: "Rejected / blocked", count: counts.blocked },
          ]}
        />
      </div>
      <div className="mt-4">
        <DataTable data={shown} columns={columns} getRowId={(a) => a.id} loading={loading} onRowClick={(a) => router.push(`/admin/astrologers/${a.id}`)} onRefresh={load}
          searchPlaceholder="Search name, email, phone, skill…" emptyTitle="No astrologers here" emptyMessage="Applications from /astrologer/apply and your invites appear here." pageSize={12} />
      </div>
      <InviteModal open={invite} onClose={() => setInvite(false)} onDone={(a) => setRows((r) => [a, ...r])} />
    </div>
  );
}

export type { AstrologerStatus };
