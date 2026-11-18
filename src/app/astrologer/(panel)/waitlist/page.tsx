"use client";

/**
 * Waitlist (real). While you are in a chat, customers can line up instead of
 * being turned away. When your chat ends, the next person gets their turn and
 * has a short time to take it; their request then rings on Live requests.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ListOrdered, X } from "lucide-react";
import { AdminButton, Badge, Card, PageHeader, StatsSkeleton, Toggle, useAdminToast, useOnMount } from "@/app/admin/_components";
import { partnerApi, type WaitlistState } from "@/lib/astrologer-api";
import { useConsultInbox } from "../../_components/consult-inbox";

export default function WaitlistPage() {
  const { toast } = useAdminToast();
  const inbox = useConsultInbox();
  const [data, setData] = useState<WaitlistState | null>(null);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    const r = await partnerApi.waitlist.get();
    if (r.ok) setData(r.data); else toast(r.message, "error");
  }, [toast]);
  useOnMount(() => { void load(); });
  // The inbox poll tells us when the line changes.
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [inbox.waiting, load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  async function act(body: Parameters<typeof partnerApi.waitlist.act>[0], msg?: string) {
    const r = await partnerApi.waitlist.act(body);
    if (!r.ok) return toast(r.message, "error");
    setData(r.data);
    if (msg) toast(msg, "info");
  }

  if (!data) return <StatsSkeleton count={2} />;
  return (
    <div className="space-y-6">
      <PageHeader title="Waitlist" subtitle={`Customers line up while you are in a chat (up to ${data.maxSize}). The next person gets their turn when your chat ends.`} />
      {!data.enabled && <Card className="p-4"><p className="text-sm" style={{ color: "var(--a-muted)" }}>The waitlist is turned off by AstroUnkle right now.</p></Card>}
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <ListOrdered size={18} style={{ color: "var(--a-gold)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{data.open ? "Taking a waitlist" : "Waitlist closed"}</p>
          <p className="text-xs" style={{ color: "var(--a-muted)" }}>{data.open ? "Busy customers can wait for you." : "Customers are told you are busy and can pick someone else."}</p>
        </div>
        <Toggle checked={data.open} onChange={(v) => void act({ action: v ? "open" : "close" }, v ? "Waitlist open" : "Waitlist closed. People already waiting keep their place.")} label="Accept waitlist" />
      </Card>

      {data.entries.length === 0 ? (
        <Card className="py-12 text-center"><p className="text-sm" style={{ color: "var(--a-muted)" }}>No one is waiting.</p></Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
            {data.entries.map((e, i) => {
              const left = e.offerExpiresAt && now ? Math.max(0, Math.ceil((Date.parse(e.offerExpiresAt) - now) / 1000)) : null;
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="w-6 text-center font-semibold" style={{ color: "var(--a-muted)" }}>#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium" style={{ color: "var(--a-fg)" }}>{e.customerName}</p>
                    {e.question && <p className="text-xs" style={{ color: "var(--a-muted)" }}>&ldquo;{e.question}&rdquo;</p>}
                    <p className="text-xs" style={{ color: "var(--a-faint)" }}>Waiting since {new Date(e.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
                  </div>
                  {e.status === "offered" ? <Badge tone="gold">Their turn{left !== null ? ` · ${left}s` : ""}</Badge> : <Badge tone="muted">Waiting</Badge>}
                  <AdminButton variant="ghost" onClick={() => act({ action: "remove", id: e.id }, `${e.customerName} removed from the line`)} aria-label={`Remove ${e.customerName}`}><X size={14} /></AdminButton>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <p className="text-sm" style={{ color: "var(--a-muted)" }}>When a person takes their turn, the request rings on <Link href="/astrologer/requests" style={{ color: "var(--a-gold)" }}>Live requests</Link> as usual.</p>
    </div>
  );
}
