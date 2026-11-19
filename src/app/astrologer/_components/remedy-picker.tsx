"use client";

/**
 * Remedy suggestions inside a live chat (astrologer side).
 *  • RemedyPicker: search shop products and poojas, add a short note, send as
 *    a card. Shows the commission on one unit at today's price.
 *  • RemedyCardBubble: how a sent card looks in the conversation.
 */

import { useEffect, useMemo, useState } from "react";
import { Gem, IndianRupee, Loader2, Sparkles } from "lucide-react";
import { AdminButton, AdminTextarea, Badge, Modal, SearchInput, Tabs, useAdminToast } from "@/app/admin/_components";
import { partnerApi, type ConsultMessage, type RemedyCatalogItem, type RemedyKind, type RemedyRules, type RemedySuggestion } from "@/lib/astrologer-api";

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const rs = (n: number) => `₹${n.toLocaleString("en-IN")}`;
function newClientId() {
  try { return crypto.randomUUID().replace(/-/g, ""); } catch { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; }
}

type Tab = "all" | RemedyKind;

export function RemedyPicker({ open, onClose, sessionId, customerName, onSent }: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  customerName: string;
  onSent: (m: ConsultMessage) => void;
}) {
  const { toast } = useAdminToast();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<RemedyCatalogItem[] | null>(null);
  const [rules, setRules] = useState<RemedyRules | null>(null);
  const [sent, setSent] = useState<RemedySuggestion[]>([]);
  const [pick, setPick] = useState<RemedyCatalogItem | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // What was already suggested in this chat (limit + no repeats).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void partnerApi.remedies.forSession(sessionId).then((r) => { if (alive && r.ok) { setSent(r.data.suggestions); setRules(r.data.rules); } });
    return () => { alive = false; };
  }, [open, sessionId]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = setTimeout(() => {
      setItems(null);
      void partnerApi.remedies.catalog(q.trim(), tab === "all" ? undefined : tab).then((r) => {
        if (!alive) return;
        if (r.ok) { setItems(r.data.items); setRules(r.data.rules); } else { setItems([]); toast(r.message, "error"); }
      });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [open, q, tab, toast]);

  const already = useMemo(() => new Set(sent.map((s) => `${s.kind}:${s.itemId}`)), [sent]);
  const left = rules ? Math.max(0, rules.maxPerChat - sent.length) : null;

  function close() { setPick(null); setNote(""); onClose(); }

  async function send() {
    if (!pick || busy) return;
    setBusy(true);
    const r = await partnerApi.remedies.suggest(sessionId, { kind: pick.kind, itemId: pick.id, note: note.trim(), clientId: newClientId() });
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    setSent((cur) => [...cur, r.data.suggestion]);
    onSent(r.data.message);
    toast(`Sent ${pick.name} to ${customerName}.`, "success");
    close();
  }

  return (
    <Modal open={open} onClose={close} size="lg" title={pick ? "Add a note and send" : "Suggest a remedy"}
      subtitle={rules ? `You earn ${rules.commissionPct}% when ${customerName} buys it within ${rules.attributionDays} days.${left !== null ? ` ${left} of ${rules.maxPerChat} left in this chat.` : ""}` : undefined}>
      {rules && !rules.enabled ? (
        <p className="py-6 text-center text-sm" style={{ color: "var(--a-muted)" }}>Remedy suggestions are turned off right now.</p>
      ) : pick ? (
        <div className="space-y-4">
          <Row it={pick} />
          <AdminTextarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={300} aria-label="Note for the customer"
            placeholder={pick.kind === "pooja" ? "Why this pooja helps, and when to do it." : "Why this helps, and how to wear or use it (finger, day, metal)."} />
          <p className="text-xs" style={{ color: "var(--a-faint)" }}>Never promise a guaranteed result. Phone numbers and links are hidden automatically.</p>
          <div className="flex justify-end gap-2">
            <AdminButton variant="ghost" onClick={() => setPick(null)}>Back</AdminButton>
            <AdminButton onClick={send} loading={busy}><Sparkles size={15} /> Send to {customerName}</AdminButton>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs<Tab> variant="pills" value={tab} onChange={setTab} tabs={[
              ...(rules?.allowProducts !== false && rules?.allowPoojas !== false ? [{ value: "all" as Tab, label: "All" }] : []),
              ...(rules?.allowProducts !== false ? [{ value: "product" as Tab, label: "Shop" }] : []),
              ...(rules?.allowPoojas !== false ? [{ value: "pooja" as Tab, label: "Poojas" }] : []),
            ]} />
            <div className="min-w-[12rem] flex-1"><SearchInput value={q} onChange={setQ} placeholder="Search: yellow sapphire, Shani, rudraksha…" /></div>
          </div>
          <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
            {!items ? (
              <p className="flex items-center justify-center gap-2 py-8 text-sm" style={{ color: "var(--a-muted)" }}><Loader2 size={15} className="animate-spin" /> Loading</p>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: "var(--a-muted)" }}>Nothing found. Try another word.</p>
            ) : items.map((it) => {
              const done = already.has(`${it.kind}:${it.id}`);
              const off = done || !it.inStock || left === 0;
              return (
                <button key={`${it.kind}:${it.id}`} disabled={off} onClick={() => setPick(it)}
                  className="w-full rounded-lg border p-0 text-left transition-colors enabled:hover:bg-black/[0.03] disabled:opacity-55" style={{ borderColor: "var(--a-border)" }}>
                  <Row it={it} badge={done ? "Already sent" : !it.inStock ? "Out of stock" : undefined} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Row({ it, badge }: { it: RemedyCatalogItem; badge?: string }) {
  return (
    <div className="flex items-center gap-3 p-2.5">
      <Thumb src={it.image} kind={it.kind} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" style={{ color: "var(--a-fg)" }}>{it.name}</p>
        <p className="truncate text-xs" style={{ color: "var(--a-muted)" }}>
          {it.kind === "pooja" ? "from " : ""}{rs(it.price)}{it.mrp ? <s className="ml-1">{rs(it.mrp)}</s> : null}{it.tag ? ` · ${it.tag}` : ""}
        </p>
      </div>
      {badge ? <Badge tone="muted">{badge}</Badge> : (
        <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-emerald-700"><IndianRupee size={11} />{inr(it.commissionPaise).slice(1)} for you</span>
      )}
    </div>
  );
}

function Thumb({ src, kind }: { src: string; kind: RemedyKind }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md" style={{ background: "var(--a-gold-soft)" }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : kind === "pooja" ? <Sparkles size={18} style={{ color: "var(--a-gold)" }} /> : <Gem size={18} style={{ color: "var(--a-gold)" }} />}
    </div>
  );
}

/** A sent remedy card inside the conversation (astrologer's own bubble). */
export function RemedyCardBubble({ card }: { card: NonNullable<ConsultMessage["card"]> }) {
  return (
    <div className="w-72 max-w-full overflow-hidden rounded-xl border bg-white" style={{ borderColor: "var(--a-border)" }}>
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ background: "var(--a-gold-soft)", color: "var(--a-fg)" }}>
        <Sparkles size={12} /> Suggested {card.kind === "pooja" ? "pooja" : "remedy"}
      </div>
      <div className="flex items-center gap-3 p-3">
        <Thumb src={card.image} kind={card.kind} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{card.name}</p>
          <p className="text-xs" style={{ color: "var(--a-muted)" }}>{card.kind === "pooja" ? "from " : ""}{rs(card.price)}{card.mrp ? <s className="ml-1">{rs(card.mrp)}</s> : null}</p>
        </div>
      </div>
      {card.note ? <p className="whitespace-pre-wrap break-words border-t px-3 py-2 text-xs" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>{card.note}</p> : null}
    </div>
  );
}
