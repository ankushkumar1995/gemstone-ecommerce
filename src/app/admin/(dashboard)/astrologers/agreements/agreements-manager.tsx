"use client";

/**
 * Admin → Partner Agreements. Every version with its status and signing
 * progress. The current version is highlighted with reminders and a link to
 * who has (not) signed. New versions start as a copy of the latest one.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, FilePlus2, FileSignature, ShieldCheck, Users } from "lucide-react";
import { astroAdminApi } from "@/lib/admin-astro-api";
import type { AgreementListItem } from "@/modules/agreements/agreement.types";
import {
  AdminBreadcrumb, AdminButton, Badge, Card, ConfirmDialog, EmptyState, PageHeader, ProgressBar, StatsSkeleton, StatusPill, useAdminToast, useOnMount,
} from "../../../_components";
import { AGR_STATUS, fmtDay, fmtIst, nowMs } from "./agreement-meta";

export function AgreementsManager() {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [items, setItems] = useState<AgreementListItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [askRemind, setAskRemind] = useState(false);

  const load = async () => {
    const r = await astroAdminApi.agreements.list();
    if (r.ok) setItems(r.data); else { toast(r.message, "error"); setItems([]); }
  };
  useOnMount(load);

  if (!items) return <StatsSkeleton count={3} />;
  const current = items.find((v) => v.status === "published") ?? null;
  const draft = items.find((v) => v.status === "draft") ?? null;
  const latest = current ?? items.find((v) => v.status === "retired") ?? null;

  const newVersion = async () => {
    if (draft) { router.push(`/admin/astrologers/agreements/${draft.id}`); return; }
    setBusy(true);
    const now = new Date();
    const r = latest
      ? await astroAdminApi.agreements.clone(latest.id)
      : await astroAdminApi.agreements.create({
          version: "1.0", title: "Partner Services Agreement", changes: [], clauses: [], keyPoints: [],
          effectiveFrom: now.toISOString(), signDeadline: new Date(now.getTime() + 30 * 86400_000).toISOString(),
        });
    setBusy(false);
    if (!r.ok) { toast(r.message, "error"); return; }
    toast(`Draft v${r.data.version} created`, "success");
    router.push(`/admin/astrologers/agreements/${r.data.id}`);
  };

  const remind = async () => {
    if (!current) return;
    const r = await astroAdminApi.agreements.remind(current.id);
    if (r.ok) toast(r.data.sent ? `Reminder sent to ${r.data.sent} partner${r.data.sent === 1 ? "" : "s"}` : "Everyone has signed. No reminder needed.", "success");
    else toast(r.message, "error");
    void load();
  };

  const pct = current && current.targetCount ? Math.round((Math.min(current.signedCount, current.targetCount) / current.targetCount) * 100) : 0;
  const deadlinePassed = current ? Date.parse(current.signDeadline) < nowMs() : false;

  return (
    <div className="space-y-6">
      <AdminBreadcrumb items={[{ label: "Astrologers", href: "/admin/astrologers" }, { label: "Partner Agreements" }]} />
      <PageHeader
        title="Partner Agreements"
        subtitle="Versions partners must sign before going online. Published text is locked and fingerprinted."
        action={<AdminButton onClick={newVersion} disabled={busy}><FilePlus2 size={16} />{draft ? `Continue draft v${draft.version}` : "New version"}</AdminButton>}
      />

      {current ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--a-gold-soft)", color: "var(--a-gold)" }}><FileSignature size={22} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold" style={{ color: "var(--a-fg)" }}>{current.title} · v{current.version}</p>
                <StatusPill tone="green">Current</StatusPill>
                {deadlinePassed && <StatusPill tone="rose">Deadline passed</StatusPill>}
              </div>
              <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
                Published {fmtIst(current.publishedAt)}{current.publishedBy ? ` by ${current.publishedBy}` : ""} · Sign by <b>{fmtIst(current.signDeadline)}</b>
              </p>
              <div className="mt-3 max-w-md">
                <div className="mb-1 flex justify-between text-xs" style={{ color: "var(--a-muted)" }}>
                  <span>{current.signedCount} of {current.targetCount} approved partners signed</span><span>{pct}%</span>
                </div>
                <ProgressBar value={pct} tone={pct === 100 ? "green" : "gold"} />
              </div>
              <p className="mt-2 flex items-center gap-1.5 font-mono text-[11px]" style={{ color: "var(--a-faint)" }}><ShieldCheck size={12} /> SHA-256 {current.contentHash}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/astrologers/agreements/${current.id}`}><AdminButton variant="outline"><Users size={15} />Signatures</AdminButton></Link>
              <AdminButton variant="outline" onClick={() => setAskRemind(true)} disabled={current.signedCount >= current.targetCount}><BellRing size={15} />Remind unsigned</AdminButton>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-5">
          <p className="font-semibold" style={{ color: "var(--a-fg)" }}>No agreement is published</p>
          <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>Partners can go online without signing until you publish a version.</p>
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState title="No versions yet" message="Create the first version of the partner agreement." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide" style={{ borderColor: "var(--a-border)", color: "var(--a-faint)" }}>
                <th className="px-5 py-3 font-semibold">Version</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Effective</th>
                <th className="px-3 py-3 font-semibold">Sign by</th>
                <th className="px-3 py-3 font-semibold">Signed</th>
                <th className="px-3 py-3 font-semibold">Published</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-black/[0.02]" style={{ borderColor: "var(--a-border)" }}>
                  <td className="px-5 py-3">
                    <p className="font-semibold" style={{ color: "var(--a-fg)" }}>v{v.version}</p>
                    <p className="text-xs" style={{ color: "var(--a-muted)" }}>{v.title} · {v.clauses.length} clauses</p>
                  </td>
                  <td className="px-3 py-3"><Badge tone={AGR_STATUS[v.status].tone}>{AGR_STATUS[v.status].label}</Badge></td>
                  <td className="px-3 py-3" style={{ color: "var(--a-fg)" }}>{fmtDay(v.effectiveFrom)}</td>
                  <td className="px-3 py-3" style={{ color: "var(--a-fg)" }}>{fmtDay(v.signDeadline)}</td>
                  <td className="px-3 py-3 tabular-nums" style={{ color: "var(--a-fg)" }}>{v.status === "draft" ? "–" : v.signedCount}</td>
                  <td className="px-3 py-3 text-xs" style={{ color: "var(--a-muted)" }}>{v.publishedAt ? `${fmtDay(v.publishedAt)}${v.publishedBy ? ` · ${v.publishedBy}` : ""}` : "Not yet"}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/admin/astrologers/agreements/${v.id}`} className="text-sm font-semibold" style={{ color: "var(--a-gold)" }}>{v.status === "draft" ? "Edit" : "Open"}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog
        open={askRemind}
        onClose={() => setAskRemind(false)}
        onConfirm={remind}
        title="Send reminder?"
        message={current ? `Email every approved partner who has not signed v${current.version} yet.` : ""}
        confirmLabel="Send reminder"
      />
    </div>
  );
}
