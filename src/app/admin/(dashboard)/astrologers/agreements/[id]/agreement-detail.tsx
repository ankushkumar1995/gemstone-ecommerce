"use client";

/**
 * One agreement version.
 *  • Draft     → editor (clauses, key points, changes, dates), preview, publish, delete
 *  • Published → who signed / not signed, reminders, extensions, CSV, text, activity
 *  • Retired   → read-only text, its signatures and activity
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown, ArrowUp, BellRing, CalendarClock, Copy, Download, Eye, FileCheck2, Plus, Rocket, Save, ShieldCheck, Trash2, X,
} from "lucide-react";
import { astroAdminApi } from "@/lib/admin-astro-api";
import type { AgreementVersion, SignatureRow } from "@/modules/agreements/agreement.types";
import {
  AdminBreadcrumb, AdminButton, AdminInput, AdminTextarea, Badge, Card, ConfirmDialog, EmptyState, Field, Modal, PageHeader, SearchInput,
  StatCard, StatsSkeleton, StatusPill, Tabs, useAdminToast, useOnMount,
} from "../../../../_components";
import { AGR_STATUS, downloadCsv, fmtDay, fmtIst, fromLocalInput, nowMs, toLocalInput } from "../agreement-meta";

type Draft = Pick<AgreementVersion, "version" | "title" | "changes" | "clauses" | "keyPoints" | "effectiveFrom" | "signDeadline">;
const rid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export function AgreementDetail({ id }: { id: string }) {
  const { toast } = useAdminToast();
  const [v, setV] = useState<AgreementVersion | null>(null);
  const [missing, setMissing] = useState(false);

  const load = async () => {
    const r = await astroAdminApi.agreements.get(id);
    if (r.ok) setV(r.data); else { setMissing(true); toast(r.message, "error"); }
  };
  useOnMount(load);

  if (missing) return <EmptyState title="Version not found" message="It may have been deleted." />;
  if (!v) return <StatsSkeleton count={3} />;
  return v.status === "draft" ? <DraftEditor v={v} onSaved={setV} /> : <PublishedView v={v} />;
}

/* ================================================================== *
 * Draft editor
 * ================================================================== */

function DraftEditor({ v, onSaved }: { v: AgreementVersion; onSaved: (v: AgreementVersion) => void }) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [d, setD] = useState<Draft>({ version: v.version, title: v.title, changes: v.changes, clauses: v.clauses, keyPoints: v.keyPoints, effectiveFrom: v.effectiveFrom, signDeadline: v.signDeadline });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [askDelete, setAskDelete] = useState(false);

  const set = (patch: Partial<Draft>) => { setD((x) => ({ ...x, ...patch })); setDirty(true); };
  const move = <T,>(list: T[], i: number, dir: -1 | 1) => { const n = [...list]; const j = i + dir; if (j < 0 || j >= n.length) return n; [n[i], n[j]] = [n[j], n[i]]; return n; };

  const issues = useMemo(() => {
    const out: string[] = [];
    if (!/^\d{1,3}(\.\d{1,3}){0,2}$/.test(d.version.trim())) out.push("Version must look like 3.3");
    if (d.title.trim().length < 3) out.push("Add a title");
    if (d.clauses.length === 0) out.push("Add at least one clause");
    if (d.clauses.some((c) => c.heading.trim().length < 2 || c.body.trim().length < 10)) out.push("Every clause needs a heading and at least 10 characters of text");
    if (d.keyPoints.length === 0) out.push("Add at least one key point partners must tick");
    if (d.keyPoints.some((k) => k.text.trim().length < 5)) out.push("Key points need at least 5 characters");
    if (d.changes.some((c) => c.trim().length < 3)) out.push("Remove empty 'what changed' lines");
    if (Date.parse(d.signDeadline) < Date.parse(d.effectiveFrom)) out.push("Deadline cannot be before the effective date");
    if (Date.parse(d.signDeadline) <= nowMs()) out.push("Deadline must be in the future");
    return out;
  }, [d]);

  const save = async (): Promise<boolean> => {
    setSaving(true);
    const r = await astroAdminApi.agreements.update(v.id, {
      ...d,
      version: d.version.trim(),
      changes: d.changes.map((c) => c.trim()).filter(Boolean),
    });
    setSaving(false);
    if (!r.ok) { toast(r.message, "error"); return false; }
    onSaved(r.data);
    setD({ version: r.data.version, title: r.data.title, changes: r.data.changes, clauses: r.data.clauses, keyPoints: r.data.keyPoints, effectiveFrom: r.data.effectiveFrom, signDeadline: r.data.signDeadline });
    setDirty(false);
    toast("Draft saved", "success");
    return true;
  };

  const publish = async () => {
    if (dirty && !(await save())) return;
    const r = await astroAdminApi.agreements.publish(v.id, confirmText.trim());
    if (!r.ok) { toast(r.message, "error"); return; }
    toast(`v${r.data.version} is now the current agreement`, "success");
    setPublishOpen(false);
    router.refresh();
    onSaved(r.data);
  };

  const remove = async () => {
    const r = await astroAdminApi.agreements.remove(v.id);
    if (!r.ok) { toast(r.message, "error"); return; }
    toast("Draft deleted", "success");
    router.replace("/admin/astrologers/agreements");
  };

  return (
    <div className="space-y-6">
      <AdminBreadcrumb items={[{ label: "Partner Agreements", href: "/admin/astrologers/agreements" }, { label: `Draft v${v.version}` }]} />
      <PageHeader
        title={`Draft v${d.version || "?"}`}
        subtitle="Only drafts can be edited. Once published, the text is locked and every partner must sign it."
        action={
          <div className="flex flex-wrap gap-2">
            <AdminButton variant="outline" onClick={() => setPreview(true)}><Eye size={15} />Preview</AdminButton>
            <AdminButton variant="outline" onClick={() => void save()} disabled={!dirty || saving}><Save size={15} />{saving ? "Saving…" : dirty ? "Save draft" : "Saved"}</AdminButton>
            <AdminButton onClick={() => { setConfirmText(""); setPublishOpen(true); }} disabled={issues.length > 0}><Rocket size={15} />Publish</AdminButton>
          </div>
        }
      />

      {issues.length > 0 && (
        <Card className="border-amber-300 p-4">
          <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Before you can publish</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm" style={{ color: "var(--a-muted)" }}>{issues.map((i) => <li key={i}>{i}</li>)}</ul>
        </Card>
      )}

      <Card className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Version" required hint="Higher than every earlier version"><AdminInput value={d.version} onChange={(e) => set({ version: e.target.value.replace(/[^\d.]/g, "").slice(0, 11) })} /></Field>
        <Field label="Title" required><AdminInput value={d.title} onChange={(e) => set({ title: e.target.value.slice(0, 140) })} /></Field>
        <Field label="Effective from" required><AdminInput type="datetime-local" value={toLocalInput(d.effectiveFrom)} onChange={(e) => e.target.value && set({ effectiveFrom: fromLocalInput(e.target.value) })} /></Field>
        <Field label="Sign by (deadline)" required hint="After this, unsigned partners cannot go online"><AdminInput type="datetime-local" value={toLocalInput(d.signDeadline)} onChange={(e) => e.target.value && set({ signDeadline: fromLocalInput(e.target.value) })} /></Field>
      </Card>

      {/* what changed */}
      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>What changed</p><p className="text-xs" style={{ color: "var(--a-muted)" }}>Short bullets shown to partners before they read. Optional for a first version.</p></div>
          <AdminButton variant="outline" onClick={() => set({ changes: [...d.changes, ""] })} disabled={d.changes.length >= 20}><Plus size={14} />Add</AdminButton>
        </div>
        {d.changes.map((c, i) => (
          <div key={i} className="flex gap-2">
            <AdminInput value={c} onChange={(e) => set({ changes: d.changes.map((x, k) => (k === i ? e.target.value.slice(0, 240) : x)) })} placeholder="e.g. Commission for video calls changed to 35%" />
            <AdminButton variant="ghost" aria-label="Remove line" onClick={() => set({ changes: d.changes.filter((_, k) => k !== i) })}><X size={15} /></AdminButton>
          </div>
        ))}
      </Card>

      {/* key points */}
      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Key points partners must tick</p><p className="text-xs" style={{ color: "var(--a-muted)" }}>Each one is a checkbox before signing. Keep them short and clear.</p></div>
          <AdminButton variant="outline" onClick={() => set({ keyPoints: [...d.keyPoints, { id: rid("kp"), text: "" }] })} disabled={d.keyPoints.length >= 10}><Plus size={14} />Add</AdminButton>
        </div>
        {d.keyPoints.map((k, i) => (
          <div key={k.id} className="flex gap-2">
            <AdminInput value={k.text} onChange={(e) => set({ keyPoints: d.keyPoints.map((x) => (x.id === k.id ? { ...x, text: e.target.value.slice(0, 240) } : x)) })} placeholder="I will not take payments outside Astrounkle." />
            <AdminButton variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => set({ keyPoints: move(d.keyPoints, i, -1) })}><ArrowUp size={15} /></AdminButton>
            <AdminButton variant="ghost" aria-label="Remove key point" onClick={() => set({ keyPoints: d.keyPoints.filter((x) => x.id !== k.id) })}><X size={15} /></AdminButton>
          </div>
        ))}
      </Card>

      {/* clauses */}
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Clauses ({d.clauses.length})</p><p className="text-xs" style={{ color: "var(--a-muted)" }}>The legal text, in order. Have your lawyer review it before publishing.</p></div>
          <AdminButton variant="outline" onClick={() => set({ clauses: [...d.clauses, { id: rid("c"), heading: `${d.clauses.length + 1}. `, body: "" }] })} disabled={d.clauses.length >= 60}><Plus size={14} />Add clause</AdminButton>
        </div>
        {d.clauses.length === 0 && <p className="text-sm" style={{ color: "var(--a-faint)" }}>No clauses yet.</p>}
        {d.clauses.map((c, i) => (
          <div key={c.id} className="rounded-xl border p-4" style={{ borderColor: "var(--a-border)" }}>
            <div className="flex gap-2">
              <AdminInput value={c.heading} onChange={(e) => set({ clauses: d.clauses.map((x) => (x.id === c.id ? { ...x, heading: e.target.value.slice(0, 160) } : x)) })} placeholder="Clause heading" aria-label={`Clause ${i + 1} heading`} className="font-semibold" />
              <AdminButton variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => set({ clauses: move(d.clauses, i, -1) })}><ArrowUp size={15} /></AdminButton>
              <AdminButton variant="ghost" aria-label="Move down" disabled={i === d.clauses.length - 1} onClick={() => set({ clauses: move(d.clauses, i, 1) })}><ArrowDown size={15} /></AdminButton>
              <AdminButton variant="ghost" aria-label="Remove clause" onClick={() => set({ clauses: d.clauses.filter((x) => x.id !== c.id) })}><Trash2 size={15} /></AdminButton>
            </div>
            <AdminTextarea rows={4} className="mt-2" value={c.body} onChange={(e) => set({ clauses: d.clauses.map((x) => (x.id === c.id ? { ...x, body: e.target.value.slice(0, 8000) } : x)) })} placeholder="Clause text" aria-label={`Clause ${i + 1} text`} />
            <p className="mt-1 text-right text-[11px]" style={{ color: "var(--a-faint)" }}>{c.body.length} / 8000</p>
          </div>
        ))}
      </Card>

      <div className="flex justify-end">
        <AdminButton variant="danger" onClick={() => setAskDelete(true)}><Trash2 size={15} />Delete draft</AdminButton>
      </div>

      <Modal open={preview} onClose={() => setPreview(false)} title={`Preview · v${d.version}`} subtitle="What partners will read" size="lg">
        <VersionText v={d} />
      </Modal>

      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title={`Publish v${d.version}?`} subtitle="This cannot be undone." size="sm">
        <div className="space-y-4 text-sm" style={{ color: "var(--a-fg)" }}>
          <ul className="list-disc space-y-1 pl-5" style={{ color: "var(--a-muted)" }}>
            <li>The text is locked and fingerprinted. Changes later need a new version.</li>
            <li>The current version is retired. Its signatures stay as records.</li>
            <li>Every partner must sign v{d.version} by <b style={{ color: "var(--a-fg)" }}>{fmtIst(d.signDeadline)}</b>, or they cannot go online.</li>
            <li>New partners must sign before their first time online.</li>
          </ul>
          <Field label={`Type ${d.version} to confirm`}><AdminInput value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus /></Field>
          <AdminButton className="w-full" onClick={publish} disabled={confirmText.trim() !== d.version.trim()}><Rocket size={15} />Publish now</AdminButton>
        </div>
      </Modal>

      <ConfirmDialog open={askDelete} onClose={() => setAskDelete(false)} onConfirm={remove} title="Delete this draft?" message="The draft is removed for good. Published versions are never affected." confirmLabel="Delete" danger />
    </div>
  );
}

/* ================================================================== *
 * Published / retired
 * ================================================================== */

type Tab = "signatures" | "text" | "activity";
type Filter = "all" | "signed" | "unsigned";

function PublishedView({ v }: { v: AgreementVersion }) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [tab, setTab] = useState<Tab>("signatures");
  const [rows, setRows] = useState<SignatureRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [ext, setExt] = useState<SignatureRow | null>(null);
  const [extForm, setExtForm] = useState({ until: "", reason: "" });
  const [askRemind, setAskRemind] = useState(false);
  const [busy, setBusy] = useState(false);
  const isCurrent = v.status === "published";

  const load = async () => {
    const r = await astroAdminApi.agreements.signatures(v.id);
    if (r.ok) setRows(r.data.rows); else { toast(r.message, "error"); setRows([]); }
  };
  useOnMount(load);

  const approved = rows?.filter((r) => r.status === "approved") ?? [];
  const signedApproved = approved.filter((r) => r.signed).length;
  const shown = (rows ?? [])
    .filter((r) => (filter === "all" ? true : filter === "signed" ? r.signed : !r.signed))
    .filter((r) => !q.trim() || [r.displayName, r.legalName, r.email, r.certificateNo ?? ""].some((x) => x.toLowerCase().includes(q.trim().toLowerCase())));

  const remind = async () => {
    const r = await astroAdminApi.agreements.remind(v.id);
    if (r.ok) toast(r.data.sent ? `Reminder sent to ${r.data.sent} partner${r.data.sent === 1 ? "" : "s"}` : "Nobody to remind", "success");
    else toast(r.message, "error");
  };

  const newFromThis = async () => {
    setBusy(true);
    const r = await astroAdminApi.agreements.clone(v.id);
    setBusy(false);
    if (!r.ok) { toast(r.message, "error"); return; }
    router.push(`/admin/astrologers/agreements/${r.data.id}`);
  };

  const saveExt = async () => {
    if (!ext) return;
    const r = await astroAdminApi.agreements.extend(v.id, { astrologerId: ext.astrologerId, until: fromLocalInput(extForm.until), reason: extForm.reason.trim() });
    if (!r.ok) { toast(r.message, "error"); return; }
    toast(`Deadline extended for ${ext.displayName}`, "success");
    setExt(null);
    void load();
  };
  const removeExt = async (row: SignatureRow) => {
    const r = await astroAdminApi.agreements.removeExtension(v.id, row.astrologerId);
    if (r.ok) { toast("Extension removed", "success"); void load(); } else toast(r.message, "error");
  };

  const csv = () => {
    if (!rows) return;
    downloadCsv(`agreement-v${v.version}-signatures.csv`,
      ["Partner", "Legal name", "Email", "Account status", "Signed", "Signed at (IST)", "Certificate", "Extended until (IST)"],
      rows.map((r) => [r.displayName, r.legalName, r.email, r.status, r.signed ? "Yes" : "No", r.signedAt ? fmtIst(r.signedAt) : "", r.certificateNo ?? "", r.extendedUntil ? fmtIst(r.extendedUntil) : ""]));
  };

  return (
    <div className="space-y-6">
      <AdminBreadcrumb items={[{ label: "Partner Agreements", href: "/admin/astrologers/agreements" }, { label: `v${v.version}` }]} />
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold" style={{ color: "var(--a-fg)" }}>{v.title} · v{v.version}</h1>
              <StatusPill tone={AGR_STATUS[v.status].tone}>{AGR_STATUS[v.status].label}</StatusPill>
            </div>
            <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
              Effective {fmtDay(v.effectiveFrom)} · Sign by {fmtIst(v.signDeadline)} · Published {fmtIst(v.publishedAt)}{v.publishedBy ? ` by ${v.publishedBy}` : ""}{v.retiredAt ? ` · Retired ${fmtDay(v.retiredAt)}` : ""}
            </p>
            <p className="mt-2 flex items-center gap-1.5 break-all font-mono text-[11px]" style={{ color: "var(--a-faint)" }}><ShieldCheck size={12} className="shrink-0" /> SHA-256 {v.contentHash}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isCurrent && <AdminButton variant="outline" onClick={() => setAskRemind(true)}><BellRing size={15} />Remind unsigned</AdminButton>}
            <AdminButton variant="outline" onClick={newFromThis} disabled={busy}><Copy size={15} />New version from this</AdminButton>
          </div>
        </div>
      </Card>

      {rows && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={FileCheck2} value={`${signedApproved}/${approved.length}`} label="Approved partners signed" tone="gold" />
          <StatCard icon={CalendarClock} value={rows.filter((r) => r.extendedUntil && !r.signed).length} label="Extensions given" tone="blue" />
          <StatCard icon={X} value={approved.length - signedApproved} label="Approved, not signed" tone="rose" />
        </div>
      )}

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { value: "signatures", label: "Signatures", count: rows ? rows.filter((r) => r.signed).length : undefined },
        { value: "text", label: "Agreement text" },
        { value: "activity", label: "Activity", count: v.activity.length },
      ]} />

      {tab === "signatures" && (
        !rows ? <StatsSkeleton count={1} /> : (
          <Card className="p-0">
            <div className="flex flex-wrap items-center gap-3 border-b p-4" style={{ borderColor: "var(--a-border)" }}>
              <SearchInput value={q} onChange={setQ} placeholder="Search name, email or certificate…" className="min-w-[220px] flex-1" />
              <div className="flex gap-1">
                {(["all", "signed", "unsigned"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
                    className="rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors"
                    style={{ borderColor: filter === f ? "var(--a-gold)" : "var(--a-border)", color: filter === f ? "var(--a-gold)" : "var(--a-muted)", background: filter === f ? "var(--a-gold-soft)" : "transparent" }}>
                    {f === "unsigned" ? "Not signed" : f}
                  </button>
                ))}
              </div>
              <AdminButton variant="outline" onClick={csv}><Download size={15} />CSV</AdminButton>
            </div>
            {shown.length === 0 ? (
              <p className="p-6 text-center text-sm" style={{ color: "var(--a-faint)" }}>Nobody matches.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide" style={{ borderColor: "var(--a-border)", color: "var(--a-faint)" }}>
                      <th className="px-4 py-3 font-semibold">Partner</th><th className="px-3 py-3 font-semibold">Account</th><th className="px-3 py-3 font-semibold">Signature</th><th className="px-3 py-3 font-semibold">Extension</th><th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.astrologerId} className="border-b last:border-0" style={{ borderColor: "var(--a-border)" }}>
                        <td className="px-4 py-3">
                          <Link href={`/admin/astrologers/${r.astrologerId}`} className="font-medium hover:underline" style={{ color: "var(--a-fg)" }}>{r.displayName}</Link>
                          <p className="text-xs" style={{ color: "var(--a-muted)" }}>{r.legalName} · {r.email}</p>
                        </td>
                        <td className="px-3 py-3"><Badge tone={r.status === "approved" ? "green" : "muted"}>{r.status.replace("_", " ")}</Badge></td>
                        <td className="px-3 py-3">
                          {r.signed ? (
                            <>
                              <p style={{ color: "var(--a-fg)" }}>{fmtIst(r.signedAt)}</p>
                              <Link href={`/admin/astrologers/agreements/signatures/${r.acceptanceId}`} className="font-mono text-xs" style={{ color: "var(--a-gold)" }}>{r.certificateNo}</Link>
                            </>
                          ) : <Badge tone="rose">Not signed</Badge>}
                        </td>
                        <td className="px-3 py-3 text-xs" style={{ color: "var(--a-muted)" }}>{r.extendedUntil ? `Until ${fmtIst(r.extendedUntil)}` : "–"}</td>
                        <td className="px-4 py-3 text-right">
                          {isCurrent && !r.signed && (
                            <div className="flex justify-end gap-2">
                              {r.extendedUntil && <AdminButton variant="ghost" onClick={() => removeExt(r)}>Remove extension</AdminButton>}
                              <AdminButton variant="outline" onClick={() => { setExtForm({ until: toLocalInput(new Date(Math.max(Date.parse(v.signDeadline), Date.now()) + 7 * 86400_000).toISOString()), reason: "" }); setExt(r); }}>
                                <CalendarClock size={14} />{r.extendedUntil ? "Change" : "Extend"}
                              </AdminButton>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )
      )}

      {tab === "text" && <Card className="p-6"><VersionText v={v} /></Card>}

      {tab === "activity" && (
        <Card className="p-5">
          <ul className="space-y-3">
            {v.activity.map((e, i) => (
              <li key={`${e.at}-${i}`} className="border-l-2 pl-3" style={{ borderColor: "var(--a-gold-soft)" }}>
                <p className="text-sm" style={{ color: "var(--a-fg)" }}>{e.action}</p>
                {e.note && <p className="text-xs" style={{ color: "var(--a-muted)" }}>{e.note}</p>}
                <p className="text-xs" style={{ color: "var(--a-faint)" }}>{fmtIst(e.at)} · {e.actor}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={!!ext} onClose={() => setExt(null)} title={ext ? `More time for ${ext.displayName}` : ""} subtitle="They can keep going online until this date. They get an email." size="sm">
        <div className="space-y-4">
          <Field label="New deadline" required hint="After the current deadline, at most 90 days later"><AdminInput type="datetime-local" value={extForm.until} onChange={(e) => setExtForm({ ...extForm, until: e.target.value })} /></Field>
          <Field label="Reason (internal record)" required><AdminTextarea rows={3} value={extForm.reason} onChange={(e) => setExtForm({ ...extForm, reason: e.target.value.slice(0, 300) })} placeholder="e.g. Travelling, asked for a week" /></Field>
          <AdminButton className="w-full" onClick={saveExt} disabled={!extForm.until || extForm.reason.trim().length < 5}>Save extension</AdminButton>
        </div>
      </Modal>

      <ConfirmDialog open={askRemind} onClose={() => setAskRemind(false)} onConfirm={remind} title="Send reminder?" message={`Email every approved partner who has not signed v${v.version}.`} confirmLabel="Send reminder" />
    </div>
  );
}

/* ---------------- read-only text (preview + published) ---------------- */

function VersionText({ v }: { v: Draft }) {
  return (
    <div className="space-y-5 text-sm leading-relaxed">
      <div>
        <p className="text-lg font-semibold" style={{ color: "var(--a-fg)" }}>{v.title}</p>
        <p className="text-xs" style={{ color: "var(--a-muted)" }}>Version {v.version} · effective {fmtDay(v.effectiveFrom)} · sign by {fmtIst(v.signDeadline)}</p>
      </div>
      {v.changes.filter(Boolean).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-faint)" }}>What changed</p>
          <ul className="mt-1 list-disc pl-5" style={{ color: "var(--a-fg)" }}>{v.changes.filter(Boolean).map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
      {v.clauses.map((c) => (
        <section key={c.id}>
          <h3 className="font-semibold" style={{ color: "var(--a-fg)" }}>{c.heading || "(no heading)"}</h3>
          <p className="whitespace-pre-line" style={{ color: "var(--a-muted)" }}>{c.body || "(empty)"}</p>
        </section>
      ))}
      {v.keyPoints.length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--a-border)" }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-faint)" }}>Partners must tick</p>
          <ul className="space-y-1.5">{v.keyPoints.map((k) => <li key={k.id} className="flex items-start gap-2" style={{ color: "var(--a-fg)" }}><input type="checkbox" disabled className="mt-1" aria-hidden />{k.text || "(empty)"}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
