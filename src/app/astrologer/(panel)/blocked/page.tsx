"use client";

/**
 * Blocked people. Someone blocked from a chat or a live cannot request a chat,
 * join your waitlist, or comment, ask or send gifts on any of your lives.
 * They are not told they are blocked. Unblock gives all of that back.
 */

import { useCallback, useState } from "react";
import { Ban } from "lucide-react";
import { AdminButton, Badge, Card, ConfirmDialog, PageHeader, StatsSkeleton, useAdminToast, useOnMount } from "@/app/admin/_components";
import { partnerApi, type BlockRow } from "@/lib/astrologer-api";

type Data = { total: number; items: BlockRow[]; nextCursor: string | null };
const VIA: Record<string, string> = { chat: "Chat", live: "Live" };

export default function BlockedPage() {
  const { toast } = useAdminToast();
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<BlockRow | null>(null);

  const load = useCallback(async (cursor?: string) => {
    setBusy(true);
    const r = await partnerApi.blocks.list(cursor);
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    setD((cur) => (cursor && cur ? { ...r.data, items: [...cur.items, ...r.data.items] } : r.data));
  }, [toast]);
  useOnMount(() => { void load(); });

  async function unblock(b: BlockRow) {
    const r = await partnerApi.blocks.unblock(b.id);
    if (!r.ok && r.status !== 404) return toast(r.message, "error");
    setD((cur) => (cur ? { ...cur, total: Math.max(0, cur.total - 1), items: cur.items.filter((x) => x.id !== b.id) } : cur));
    toast(`${b.name} unblocked`, "success");
  }

  if (!d) return <StatsSkeleton count={2} />;
  return (
    <div className="space-y-6">
      <PageHeader title="Blocked people" subtitle="They cannot chat with you, join your waitlist, or comment, ask or send gifts on your lives. They are not told." />
      <Card className="p-0">
        <p className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
          <Ban size={15} /> {d.total} blocked
        </p>
        {d.items.length === 0 ? (
          <p className="py-12 text-center text-sm" style={{ color: "var(--a-muted)" }}>Nobody is blocked. You can block someone from a chat or from a comment on your live.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
            {d.items.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium" style={{ color: "var(--a-fg)" }}>{b.name}</p>
                  {b.reason && <p className="truncate text-xs" style={{ color: "var(--a-muted)" }}>{b.reason}</p>}
                </div>
                <Badge tone="muted">from {VIA[b.via] ?? b.via}</Badge>
                {b.at && <span className="text-xs" style={{ color: "var(--a-muted)" }}>{new Date(b.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
                <AdminButton variant="outline" onClick={() => setTarget(b)}>Unblock</AdminButton>
              </li>
            ))}
          </ul>
        )}
        {d.nextCursor && <div className="p-3 text-center"><AdminButton variant="outline" loading={busy} onClick={() => load(d.nextCursor!)}>Load more</AdminButton></div>}
      </Card>
      <ConfirmDialog open={!!target} onClose={() => setTarget(null)} confirmLabel="Unblock" title={`Unblock ${target?.name ?? ""}?`}
        message="They can request chats and comment on your lives again."
        onConfirm={async () => { const b = target; setTarget(null); if (b) await unblock(b); }} />
    </div>
  );
}
