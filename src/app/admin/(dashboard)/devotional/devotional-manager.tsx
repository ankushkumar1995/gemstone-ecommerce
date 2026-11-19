"use client";

/**
 * Admin: Mantras & Aarti. Everything the app shows in Mantras and the
 * Aarti / Chalisa / Katha library. Filter by type and status, search,
 * reorder (arrows), publish / unpublish, open the editor, bulk import JSON.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, EyeOff, FileJson, Music, Plus, Star, VolumeX } from "lucide-react";
import { AdminButton, AdminTextarea, Badge, Card, Modal, PageHeader, SearchInput, StatsSkeleton, Tabs, Toggle, useAdminToast } from "@/app/admin/_components";
import { devotionalAdminApi, type DevotionalItem } from "@/lib/admin-astro-api";
import { DEVOTIONAL_KINDS, KIND_LABEL, type DevotionalKind } from "@/modules/devotional/devotional.types";

type Tab = "all" | DevotionalKind;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function DevotionalManager() {
  const { toast } = useAdminToast();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [status, setStatus] = useState<"" | "draft" | "published">("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<DevotionalItem[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    const r = await devotionalAdminApi.list({ kind: tab === "all" ? undefined : tab, status: status || undefined, q: q.trim() || undefined });
    if (!r.ok) return toast(r.message, "error");
    setRows(r.data.items);
    setCounts(r.data.counts);
  }, [tab, status, q, toast]);
  useEffect(() => { const t = setTimeout(() => void load(), 200); return () => clearTimeout(t); }, [load]);

  async function publish(i: DevotionalItem, on: boolean) {
    const r = await devotionalAdminApi.update(i.id, { status: on ? "published" : "draft" });
    if (!r.ok) return toast(r.message, "error");
    setRows((cur) => cur?.map((x) => (x.id === i.id ? r.data.item : x)) ?? cur);
    toast(on ? `"${i.title}" is live in the app` : `"${i.title}" hidden from the app`, "success");
  }

  async function move(idx: number, dir: -1 | 1) {
    if (!rows) return;
    const j = idx + dir;
    if (j < 0 || j >= rows.length || rows[idx].kind !== rows[j].kind) return;
    const next = [...rows];
    [next[idx], next[j]] = [next[j], next[idx]];
    setRows(next);
    const sameKind = next.filter((x) => x.kind === rows[idx].kind).map((x) => x.id);
    const r = await devotionalAdminApi.reorder(sameKind);
    if (!r.ok) { toast(r.message, "error"); void load(); }
  }

  const noAudio = rows?.filter((r) => r.kind === "mantra" && !r.audio).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Mantras & Aarti" subtitle="Everything in the app's Mantras and Aarti / Chalisa / Katha library. Only published items show in the app."
        action={<div className="flex gap-2">
          <AdminButton variant="outline" onClick={() => setImportOpen(true)}><FileJson size={15} /> Import JSON</AdminButton>
          <Link href="/admin/devotional/new"><AdminButton><Plus size={15} /> Add new</AdminButton></Link>
        </div>} />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs<Tab> variant="pills" value={tab} onChange={setTab} tabs={[
          { value: "all", label: "All", count: counts.all },
          ...DEVOTIONAL_KINDS.map((k) => ({ value: k as Tab, label: KIND_LABEL[k], count: counts[k] ?? 0 })),
        ]} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[14rem] flex-1"><SearchInput value={q} onChange={setQ} placeholder="Search title, deity, slug, tag…" /></div>
        <div className="flex gap-1 rounded-lg border p-1 text-xs" style={{ borderColor: "var(--a-border)" }}>
          {([["", "Any status"], ["published", "Published"], ["draft", "Draft"]] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setStatus(v)} className="rounded-md px-2.5 py-1 font-medium"
              style={{ background: status === v ? "var(--a-gold-soft)" : undefined, color: "var(--a-fg)" }}>{l}</button>
          ))}
        </div>
      </div>

      {noAudio > 0 && <Card className="flex items-center gap-2 p-3 text-sm" style={{ color: "var(--a-muted)" }}><VolumeX size={15} /> {noAudio} mantra{noAudio === 1 ? "" : "s"} without audio. The app uses the jaap timer and mala mode for those until audio is uploaded.</Card>}

      {!rows ? <StatsSkeleton count={4} /> : rows.length === 0 ? (
        <Card className="space-y-3 py-12 text-center">
          <Music size={28} className="mx-auto" style={{ color: "var(--a-gold)" }} />
          <p className="text-sm" style={{ color: "var(--a-muted)" }}>Nothing here yet.</p>
          <div className="flex justify-center gap-2"><Link href="/admin/devotional/new"><AdminButton><Plus size={15} /> Add new</AdminButton></Link><AdminButton variant="outline" onClick={() => setImportOpen(true)}>Import JSON</AdminButton></div>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide" style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}>
                <th className="w-16 px-3 py-3">Order</th><th className="px-3 py-3">Title</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Deity</th>
                <th className="px-3 py-3">Audio</th><th className="px-3 py-3">Use</th><th className="px-3 py-3">In app</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="cursor-pointer border-b hover:bg-black/[0.03]" style={{ borderColor: "var(--a-border)" }} onClick={() => router.push(`/admin/devotional/${r.id}`)}>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-0.5">
                      <button type="button" aria-label="Move up" disabled={i === 0 || rows[i - 1].kind !== r.kind} onClick={() => void move(i, -1)} className="rounded p-1 hover:bg-black/[0.06] disabled:opacity-25"><ArrowUp size={14} /></button>
                      <button type="button" aria-label="Move down" disabled={i === rows.length - 1 || rows[i + 1].kind !== r.kind} onClick={() => void move(i, 1)} className="rounded p-1 hover:bg-black/[0.06] disabled:opacity-25"><ArrowDown size={14} /></button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium" style={{ color: "var(--a-fg)" }}>{r.featured && <Star size={12} className="mr-1 inline fill-current" style={{ color: "var(--a-gold)" }} />}{r.title}</p>
                    <p className="text-xs" style={{ color: "var(--a-muted)" }}>{r.titleHi || r.slug}</p>
                  </td>
                  <td className="px-3 py-2"><Badge tone="muted">{KIND_LABEL[r.kind]}</Badge></td>
                  <td className="px-3 py-2">{r.deity || "-"}</td>
                  <td className="px-3 py-2 text-xs">{r.audio ? <span className="inline-flex items-center gap-1"><Music size={13} /> {mmss(r.audio.durationSec)}</span> : <span style={{ color: "var(--a-faint)" }}>None</span>}</td>
                  <td className="px-3 py-2 text-xs tabular-nums" style={{ color: "var(--a-muted)" }}>{r.plays.toLocaleString("en-IN")} plays{r.kind === "mantra" ? ` · ${r.jaapCount.toLocaleString("en-IN")} jaap` : ""}</td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Toggle checked={r.status === "published"} onChange={(v) => void publish(r, v)} ariaLabel={r.status === "published" ? "Unpublish" : "Publish"} />
                      {r.status === "published" ? <Eye size={14} style={{ color: "var(--a-muted)" }} /> : <EyeOff size={14} style={{ color: "var(--a-faint)" }} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); void load(); }} />
    </div>
  );
}

const SAMPLE = `[
  {
    "slug": "m-gayatri",
    "kind": "mantra",
    "status": "published",
    "title": "Gayatri Mantra",
    "titleHi": "गायत्री मंत्र",
    "deity": "Savitri",
    "devanagari": "ॐ भूर्भुवः स्वः ...",
    "roman": "Om Bhur Bhuvah Svah ...",
    "meaning": { "en": "We meditate on ...", "hi": "हम उस ... का ध्यान करते हैं" },
    "bestTime": "Sunrise, noon and dusk",
    "days": [0, 1, 2, 3, 4, 5, 6],
    "planets": ["Sun"],
    "defaultCount": 108,
    "recitationSec": 38,
    "audio": { "url": "https://.../gayatri.mp3", "durationSec": 38, "artist": "Pt. ..." }
  },
  {
    "slug": "l-hanuman-chalisa",
    "kind": "chalisa",
    "status": "published",
    "title": "Hanuman Chalisa",
    "titleHi": "हनुमान चालीसा",
    "deity": "Hanuman",
    "blurb": "Forty verses in praise of Hanuman.",
    "verses": ["श्रीगुरु चरन सरोज रज ...", "जय हनुमान ज्ञान गुन सागर ..."]
  }
]`;

function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useAdminToast();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ created: number; updated: number; failed: { row: number; slug: string; error: string }[]; dry: boolean } | null>(null);

  async function run(dryRun: boolean) {
    let items: unknown;
    try { items = JSON.parse(raw); } catch { return toast("This is not valid JSON. Check commas and quotes.", "error"); }
    setBusy(true);
    const r = await devotionalAdminApi.importMany(items, dryRun);
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    setReport({ ...r.data, dry: dryRun });
    if (!dryRun) { toast(`Imported: ${r.data.created} new, ${r.data.updated} updated`, "success"); onDone(); setRaw(""); setReport(null); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import JSON" subtitle="A list of items. Matching slugs are updated, new slugs are added. Check first, then import." size="lg">
      <div className="space-y-3">
        <AdminTextarea value={raw} onChange={(e) => { setRaw(e.target.value); setReport(null); }} rows={14} className="font-mono text-xs" placeholder={SAMPLE} aria-label="JSON to import" />
        <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--a-muted)" }}>
          <span>Fields: slug, kind ({DEVOTIONAL_KINDS.join(", ")}), status, title, titleHi, deity, devanagari, roman, meaning.en / .hi, blurb, verses[], benefits[], bestTime, days[0-6], planets[], festivals[], tags[], defaultCount, recitationSec, audio {"{url, durationSec, artist}"}, image, featured, order.</span>
          <button type="button" className="underline" onClick={() => setRaw(SAMPLE)}>Use the example</button>
        </div>
        {report && (
          <div className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--a-border)" }}>
            <p style={{ color: "var(--a-fg)" }}>{report.dry ? "Check result" : "Imported"}: <b>{report.created}</b> new, <b>{report.updated}</b> updated, <b>{report.failed.length}</b> with problems.</p>
            {report.failed.length > 0 && <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-rose-700">{report.failed.map((f) => <li key={f.row}>Row {f.row}{f.slug ? ` (${f.slug})` : ""}: {f.error}</li>)}</ul>}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <AdminButton variant="outline" onClick={onClose}>Cancel</AdminButton>
          <AdminButton variant="outline" loading={busy} disabled={!raw.trim()} onClick={() => run(true)}>Check</AdminButton>
          <AdminButton loading={busy} disabled={!raw.trim() || !report?.dry || report.created + report.updated === 0} onClick={() => run(false)}>Import</AdminButton>
        </div>
      </div>
    </Modal>
  );
}
