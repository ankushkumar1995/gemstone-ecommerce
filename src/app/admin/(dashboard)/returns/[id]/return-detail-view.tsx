"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, RotateCcw, ExternalLink, Check, X } from "lucide-react";
import type { ReturnRequest, ReturnStatus } from "@/modules/returns";
import { adminApi } from "@/lib/admin-api";
import { formatPrice } from "@/lib/utils";
import {
  Card,
  AdminButton,
  AdminInput,
  Avatar,
  Badge,
  StatusPill,
  Timeline,
  KeyValueList,
  Toggle,
  TableSkeleton,
  EmptyState,
  AdminBreadcrumb,
  useAdminToast,
} from "@/app/admin/_components";
import { RETURN_STATUS_META, NEXT_RETURN_STATUSES, REASON_LABELS } from "../return-status";

export function ReturnDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [ret, setRet] = useState<ReturnRequest | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [note, setNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [restock, setRestock] = useState(true);

  const load = async () => {
    const res = await adminApi.returns.get(id);
    if (res.ok) {
      setRet(res.data);
      setRefundAmount(String(res.data.refundAmount ?? res.data.suggestedRefund));
      setRestock(res.data.restock);
      setState("ok");
    } else setState("missing");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (state === "loading") return <TableSkeleton rows={6} cols={2} />;
  if (state === "missing" || !ret)
    return <EmptyState title="Return not found" message="This return may have been removed." />;

  const r = ret;
  const nexts = NEXT_RETURN_STATUSES[r.status];

  const changeStatus = async (status: ReturnStatus) => {
    const payload =
      status === "refunded"
        ? { status, refundAmount: Number(refundAmount || r.suggestedRefund), restock }
        : { status };
    const res = await adminApi.returns.updateStatus(r.id, payload);
    if (res.ok) {
      setRet(res.data);
      toast(`Return ${RETURN_STATUS_META[status].label.toLowerCase()}`, "success");
    } else toast(res.message, "error");
  };

  const submitNote = async () => {
    if (!note.trim()) return;
    const res = await adminApi.returns.addNote(r.id, note.trim());
    if (res.ok) {
      setRet(res.data);
      setNote("");
      toast("Note added", "success");
    } else toast(res.message, "error");
  };

  return (
    <div>
      <AdminBreadcrumb items={[{ label: "Returns", href: "/admin/returns" }, { label: r.returnNumber }]} />

      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/returns")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04]"
            style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold" style={{ color: "var(--a-fg)" }}>{r.returnNumber}</h1>
              <StatusPill tone={RETURN_STATUS_META[r.status].tone}>{RETURN_STATUS_META[r.status].label}</StatusPill>
            </div>
            <p className="text-sm" style={{ color: "var(--a-muted)" }}>
              Requested {new Date(r.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {nexts
            .filter((s) => s !== "refunded")
            .map((s) => (
              <AdminButton key={s} variant={s === "rejected" ? "outline" : "primary"} onClick={() => changeStatus(s)}>
                {s === "rejected" ? <X size={15} /> : <Check size={15} />} {RETURN_STATUS_META[s].label}
              </AdminButton>
            ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* left */}
        <div className="space-y-6">
          {/* items */}
          <Card className="overflow-hidden p-0">
            <h2 className="border-b px-5 py-4 font-semibold" style={{ color: "var(--a-fg)", borderColor: "var(--a-border)" }}>
              Returned items ({r.items.length})
            </h2>
            <div className="divide-y" style={{ borderColor: "var(--a-border)" }}>
              {r.items.map((it, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  {it.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image} alt={it.name} className="h-12 w-12 shrink-0 rounded-lg border object-cover" style={{ borderColor: "var(--a-border)" }} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" style={{ color: "var(--a-fg)" }}>{it.name}</p>
                    <p className="text-xs" style={{ color: "var(--a-faint)" }}>Qty {it.qty} · {formatPrice(it.unitPrice)} each</p>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{formatPrice(it.lineRefund)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t px-5 py-4" style={{ borderColor: "var(--a-border)" }}>
              <span className="font-semibold" style={{ color: "var(--a-fg)" }}>Suggested refund</span>
              <span className="text-lg font-bold" style={{ color: "var(--a-fg)" }}>{formatPrice(r.suggestedRefund)}</span>
            </div>
          </Card>

          {/* reason */}
          <Card>
            <h2 className="mb-2 font-semibold" style={{ color: "var(--a-fg)" }}>Reason</h2>
            <Badge tone="muted">{REASON_LABELS[r.reason]}</Badge>
            {r.comment && (
              <p className="mt-3 whitespace-pre-wrap text-sm" style={{ color: "var(--a-muted)" }}>{r.comment}</p>
            )}
          </Card>

          {/* activity */}
          <Card>
            <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Activity</h2>
            <div className="mb-4 flex gap-2">
              <AdminInput value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitNote()} placeholder="Add a note…" />
              <AdminButton onClick={submitNote} disabled={!note.trim()}><Send size={15} /></AdminButton>
            </div>
            <Timeline
              items={r.activity.slice(0, 20).map((a) => ({
                title: a.message,
                time: `${new Date(a.at).toLocaleString()}${a.actor ? ` · ${a.actor}` : ""}`,
                done: a.type === "refund" || a.type === "created",
              }))}
            />
          </Card>
        </div>

        {/* right */}
        <div className="space-y-6">
          {/* refund action (only when received) */}
          {r.status === "received" && (
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <RotateCcw size={16} className="text-[var(--a-gold)]" />
                <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Process refund</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--a-fg)" }}>Refund amount (₹)</label>
                  <AdminInput type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
                  <p className="mt-1 text-xs" style={{ color: "var(--a-faint)" }}>Suggested: {formatPrice(r.suggestedRefund)}</p>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Restock items</p>
                    <p className="text-xs" style={{ color: "var(--a-faint)" }}>Add returned qty back to stock</p>
                  </div>
                  <Toggle checked={restock} onChange={setRestock} />
                </div>
                <AdminButton className="w-full" onClick={() => changeStatus("refunded")}>
                  <RotateCcw size={15} /> Refund {formatPrice(Number(refundAmount || r.suggestedRefund))}
                </AdminButton>
              </div>
            </Card>
          )}

          {r.status === "refunded" && r.refundAmount !== undefined && (
            <Card>
              <h2 className="mb-2 font-semibold" style={{ color: "var(--a-fg)" }}>Refund</h2>
              <p className="text-2xl font-bold text-emerald-600">{formatPrice(r.refundAmount)}</p>
              <p className="text-xs" style={{ color: "var(--a-faint)" }}>{r.restock ? "Items restocked" : "Not restocked"}</p>
            </Card>
          )}

          <Card>
            <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Customer</h2>
            <div className="flex items-center gap-3">
              <Avatar name={r.customer.name} size={40} />
              <div className="min-w-0">
                <p className="truncate font-medium" style={{ color: "var(--a-fg)" }}>{r.customer.name}</p>
                <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>{r.customer.email}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Order</h2>
            <KeyValueList items={[{ label: "Order", value: r.orderNumber }]} />
            <AdminButton variant="outline" className="mt-3 w-full" onClick={() => router.push(`/admin/orders/${r.orderId}`)}>
              <ExternalLink size={15} /> View order
            </AdminButton>
          </Card>
        </div>
      </div>
    </div>
  );
}
