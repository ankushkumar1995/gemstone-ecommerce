"use client";

/**
 * One pooja booking, end to end: next step, sankalp, pandit, schedule, proof,
 * prasad, payment & refunds, timeline and internal notes. Every button maps to
 * one server action; the server re-checks every rule and the version, so a
 * stale screen gets "reload" instead of overwriting someone else's change.
 */

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Ban, CalendarClock, CheckCircle2, ExternalLink, IndianRupee, MapPin, Phone, Play, Plus, RotateCcw, Send, Trash2, Truck, UserCheck, UserMinus, Video } from "lucide-react";
import { newRequestId, poojaAdminApi, type RefundSuggestion } from "@/lib/admin-pooja-api";
import type { BookingAction } from "@/modules/poojas/pooja.schema";
import { EDITABLE } from "@/modules/poojas/pooja.rules";
import type { Pandit, PoojaBooking, PrasadStatus, SankalpMember, ShippingAddress, SlotView } from "@/modules/poojas/pooja.types";
import {
  AdminBreadcrumb, AdminButton, AdminInput, AdminSelectPro, AdminTextarea, Badge, Card, CopyButton, EmptyState, Field, ImagePickerField, KeyValueList,
  Modal, StatsSkeleton, StatusPill, Timeline, Toggle, useAdminToast, useOnMount,
} from "../../../../_components";
import { BOOKING_STATUS, PAYMENT_STATUS, PRASAD_STATUS, fmtSlot, fmtWhen, inr } from "../../pooja-meta";
import { HavanProgress } from "./havan-progress";

type Ask = null | "assign" | "unassign" | "reschedule" | "cancel" | "refund" | "paid" | "reopen";
const PRASAD_NEXT: Record<PrasadStatus, PrasadStatus[]> = { not_required: [], pending: ["packed", "shipped"], packed: ["pending", "shipped"], shipped: ["delivered", "returned"], delivered: ["returned"], returned: ["shipped", "pending"] };
const blankMember = (): SankalpMember => ({ name: "", relation: "", gotra: "", dob: "", birthPlace: "" });
const blankAddress = (b: PoojaBooking): ShippingAddress => ({ name: b.customer.name, phone: b.customer.phone, line1: "", line2: "", city: "", state: "", postalCode: "" });

export function BookingDetail({ id }: { id: string }) {
  const { toast } = useAdminToast();
  const [b, setB] = useState<PoojaBooking | null>(null);
  const [refund, setRefund] = useState<RefundSuggestion | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<Ask>(null);
  const [pandits, setPandits] = useState<Pandit[]>([]);
  const [slots, setSlots] = useState<SlotView[]>([]);
  // form state
  const [panditId, setPanditId] = useState("");
  const [canForce, setCanForce] = useState(false);
  const [reason, setReason] = useState("");
  const [slotKey, setSlotKey] = useState("");
  const [overbook, setOverbook] = useState(false);
  const [ignoreCutoff, setIgnoreCutoff] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"razorpay" | "manual">("manual");
  const [reference, setReference] = useState("");
  const [requestId, setRequestId] = useState("");
  const [members, setMembers] = useState<SankalpMember[] | null>(null);
  const [wish, setWish] = useState<string | null>(null);
  const [address, setAddress] = useState<ShippingAddress | null>(null);
  const [proof, setProof] = useState<{ videoUrl: string; liveUrl: string; photos: string[]; note: string } | null>(null);
  const [prasad, setPrasad] = useState<{ status: PrasadStatus; courier: string; trackingNo: string; trackingUrl: string; note: string } | null>(null);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<string | null>(null);

  const load = async () => {
    const r = await poojaAdminApi.bookings.get(id);
    if (!r.ok) { setMissing(true); return; }
    setB(r.data.booking); setRefund(r.data.refund);
    setProof(null); setPrasad(null); setMembers(null); setWish(null); setAddress(null); setNotes(null);
  };
  useOnMount(async () => {
    await load();
    const p = await poojaAdminApi.pandits.list();
    if (p.ok) setPandits(p.data);
  });

  if (missing) return <EmptyState title="Booking not found" message="It may have been removed." />;
  if (!b || !refund) return <StatsSkeleton count={3} />;

  const run = async (action: BookingAction, done?: string) => {
    setBusy(true);
    const r = await poojaAdminApi.bookings.act(b.id, action);
    setBusy(false);
    if (!r.ok) {
      const det = r.details as { canForce?: boolean } | undefined;
      if (action.action === "assign" && det?.canForce) setCanForce(true);
      toast(r.message, "error");
      if (/changed by someone else/i.test(r.message)) await load();
      return false;
    }
    setB(r.data);
    const fresh = await poojaAdminApi.bookings.get(b.id);
    if (fresh.ok) setRefund(fresh.data.refund);
    if (done) toast(done, "success");
    setAsk(null); setReason(""); setCanForce(false);
    setProof(null); setPrasad(null); setMembers(null); setWish(null); setAddress(null); setNotes(null);
    return true;
  };

  const openReschedule = async () => {
    setAsk("reschedule"); setSlotKey(""); setOverbook(false); setIgnoreCutoff(false); setReason(""); setSlots([]);
    const s = await poojaAdminApi.poojas.availability(b.poojaId, undefined, 60);
    setSlots(s.ok ? s.data.filter((x) => x.key !== b.slot.key) : []);
  };
  const openMoney = (kind: "cancel" | "refund") => {
    setAsk(kind); setReason(""); setReference(""); setRequestId(newRequestId());
    setMethod(b.payment.method === "razorpay" && b.payment.razorpayPaymentId ? "razorpay" : "manual");
    setAmount(kind === "cancel" ? String(refund.amount) : String(refund.refundable));
  };

  const editable = EDITABLE.includes(b.status);
  const nextStep = (() => {
    switch (b.status) {
      case "pending_payment": return { text: "Waiting for payment.", btn: <AdminButton onClick={() => { setReference(""); setAsk("paid"); }}><IndianRupee size={15} /> Mark paid</AdminButton> };
      case "confirmed": return { text: "Assign a pandit for this pooja.", btn: <AdminButton onClick={() => { setPanditId(""); setCanForce(false); setAsk("assign"); }}><UserCheck size={15} /> Assign pandit</AdminButton> };
      case "assigned": return { text: `Start the pooja on ${fmtSlot(b.slot.date, b.slot.time)}.`, btn: <AdminButton disabled={busy} onClick={() => run({ action: "start" }, "Pooja started")}><Play size={15} /> Start pooja</AdminButton> };
      case "in_progress": return { text: "Upload the video or photos, then mark it performed.", btn: <AdminButton disabled={busy || (!b.proof.videoUrl && !b.proof.photos.length)} onClick={() => run({ action: "perform" }, "Marked performed")}><CheckCircle2 size={15} /> Mark performed</AdminButton> };
      case "performed": return ["not_required", "delivered"].includes(b.prasad.status)
        ? { text: "Everything is done. Close the booking.", btn: <AdminButton disabled={busy} onClick={() => run({ action: "complete" }, "Booking completed")}><CheckCircle2 size={15} /> Complete</AdminButton> }
        : { text: "Ship the prasad, then complete the booking.", btn: null };
      case "completed": return { text: "Completed.", btn: <AdminButton variant="ghost" onClick={() => { setReason(""); setAsk("reopen"); }}><RotateCcw size={15} /> Reopen</AdminButton> };
      case "cancelled": return { text: `Cancelled${b.cancelReason ? `: ${b.cancelReason}` : ""}.`, btn: null };
    }
  })();

  const selectedPandit = pandits.find((p) => p.id === panditId);
  const p = proof ?? { videoUrl: b.proof.videoUrl, liveUrl: b.proof.liveUrl, photos: b.proof.photos, note: b.proof.note };
  const pr = prasad ?? { status: b.prasad.status, courier: b.prasad.courier, trackingNo: b.prasad.trackingNo, trackingUrl: b.prasad.trackingUrl, note: b.prasad.note };
  const m = members ?? b.members;
  const amt = Number(amount);
  const amtOk = Number.isInteger(amt) && amt >= 0 && amt <= refund.refundable && (ask === "cancel" || amt >= 1);
  const pickedSlot = slots.find((s) => s.key === slotKey);

  return (
    <div className="pb-16">
      <AdminBreadcrumb items={[{ label: "Poojas", href: "/admin/poojas" }, { label: "Bookings", href: "/admin/poojas/bookings" }, { label: b.bookingNumber }]} />
      <div className="mb-6 mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold" style={{ color: "var(--a-fg)" }}>
            <span className="font-mono">{b.bookingNumber}</span><CopyButton value={b.bookingNumber} />
            <StatusPill tone={BOOKING_STATUS[b.status].tone}>{BOOKING_STATUS[b.status].label}</StatusPill>
            <StatusPill tone={PAYMENT_STATUS[b.payment.status].tone}>{PAYMENT_STATUS[b.payment.status].label}</StatusPill>
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}><Link href={`/admin/poojas/${b.poojaId}`} className="font-medium hover:underline" style={{ color: "var(--a-fg)" }}>{b.pooja.title}</Link> · {b.package.name} · {fmtSlot(b.slot.date, b.slot.time)}{b.slot.label ? ` · ${b.slot.label}` : ""}{b.pooja.location ? ` · ${b.pooja.location}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && <AdminButton variant="outline" onClick={openReschedule}><CalendarClock size={15} /> Reschedule</AdminButton>}
          {b.payment.status !== "unpaid" && b.payment.refunded < b.pricing.total && <AdminButton variant="outline" onClick={() => openMoney("refund")}><RotateCcw size={15} /> Refund</AdminButton>}
          {editable && <AdminButton variant="danger" onClick={() => openMoney("cancel")}><Ban size={15} /> Cancel</AdminButton>}
        </div>
      </div>

      <Card className="mb-6 flex flex-wrap items-center gap-3 p-4" style={{ borderColor: "var(--a-gold)" }}>
        <p className="flex-1 text-sm" style={{ color: "var(--a-fg)" }}><b>Next step:</b> {nextStep.text}</p>
        {nextStep.btn}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_21rem]">
        <div className="min-w-0 space-y-6">
          {/* SANKALP */}
          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between"><h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Sankalp ({b.members.length}/{b.package.members} names)</h2>{!editable && <Badge tone="muted">Locked after start</Badge>}</div>
            <div className="space-y-2">
              {m.map((x, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_8rem_8rem_9rem_auto]">
                  <AdminInput value={x.name} disabled={!editable} onChange={(e) => setMembers(m.map((y, k) => (k === i ? { ...y, name: e.target.value } : y)))} placeholder="Full name" aria-label="Name" />
                  <AdminInput value={x.relation} disabled={!editable} onChange={(e) => setMembers(m.map((y, k) => (k === i ? { ...y, relation: e.target.value } : y)))} placeholder="Relation" aria-label="Relation" />
                  <AdminInput value={x.gotra} disabled={!editable} onChange={(e) => setMembers(m.map((y, k) => (k === i ? { ...y, gotra: e.target.value } : y)))} placeholder="Gotra" aria-label="Gotra" />
                  <AdminInput type="date" value={x.dob} disabled={!editable} onChange={(e) => setMembers(m.map((y, k) => (k === i ? { ...y, dob: e.target.value } : y)))} aria-label="Date of birth" />
                  {editable && m.length > 1 ? <button type="button" aria-label="Remove name" onClick={() => setMembers(m.filter((_, k) => k !== i))} className="text-rose-600"><Trash2 size={15} /></button> : <span />}
                </div>
              ))}
              {editable && m.length < b.package.members && <button type="button" onClick={() => setMembers([...m, blankMember()])} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--a-gold)" }}><Plus size={13} /> Add name</button>}
            </div>
            <Field label="Sankalp (wish)"><AdminTextarea rows={2} value={wish ?? b.wish} disabled={!editable} onChange={(e) => setWish(e.target.value.slice(0, 2000))} /></Field>
            {editable && (members || wish !== null) && <div className="flex gap-2"><AdminButton disabled={busy || m.some((x) => x.name.trim().length < 2)} onClick={() => run({ action: "sankalp", members: m, wish: wish ?? b.wish }, "Sankalp saved")}>Save sankalp</AdminButton><AdminButton variant="ghost" onClick={() => { setMembers(null); setWish(null); }}>Discard</AdminButton></div>}
          </Card>

          {/* HAVAN PROGRESS (havan / anushthan only) */}
          {b.pooja.type === "havan" && <HavanProgress key={(b.progress ?? []).length} b={b} busy={busy} run={run} />}

          {/* PROOF */}
          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Video size={16} /> Proof for the customer</h2>{b.proof.uploadedAt && <span className="text-xs" style={{ color: "var(--a-muted)" }}>Uploaded {fmtWhen(b.proof.uploadedAt)} by {b.proof.uploadedBy}</span>}</div>
            {b.status === "cancelled" || b.status === "pending_payment" ? <p className="text-sm" style={{ color: "var(--a-faint)" }}>Not available for this booking.</p> : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Live link (any time)" hint="YouTube unlisted / Meet link"><AdminInput value={p.liveUrl} onChange={(e) => setProof({ ...p, liveUrl: e.target.value })} placeholder="https://youtu.be/..." /></Field>
                  <Field label="Pooja video" hint={["in_progress", "performed", "completed"].includes(b.status) ? "Recording link, https://" : "After the pooja starts"}><AdminInput value={p.videoUrl} disabled={!["in_progress", "performed", "completed"].includes(b.status)} onChange={(e) => setProof({ ...p, videoUrl: e.target.value })} placeholder="https://..." /></Field>
                </div>
                {["in_progress", "performed", "completed"].includes(b.status) && (
                  <Field label={`Photos (${p.photos.length}/20)`}>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {p.photos.map((ph, i) => <ImagePickerField key={i} value={ph} onChange={(u) => setProof({ ...p, photos: u ? p.photos.map((x, k) => (k === i ? u : x)) : p.photos.filter((_, k) => k !== i) })} folder="poojas" aspect="aspect-square" />)}
                      {p.photos.length < 20 && <button type="button" onClick={() => setProof({ ...p, photos: [...p.photos, ""] })} className="flex aspect-square items-center justify-center rounded-lg border border-dashed text-xs" style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}><Plus size={14} /> Photo</button>}
                    </div>
                  </Field>
                )}
                <Field label="Message to the customer (optional)"><AdminInput value={p.note} onChange={(e) => setProof({ ...p, note: e.target.value.slice(0, 500) })} placeholder="Pooja completed with full vidhi. Prasad will be shipped tomorrow." /></Field>
                {proof && <div className="flex gap-2"><AdminButton disabled={busy} onClick={() => run({ action: "proof", ...p, photos: p.photos.filter(Boolean) }, "Proof saved")}><Send size={15} /> Save & share</AdminButton><AdminButton variant="ghost" onClick={() => setProof(null)}>Discard</AdminButton></div>}
                <div className="flex flex-wrap gap-3 text-xs">
                  {b.proof.liveUrl && <a className="flex items-center gap-1 underline" href={b.proof.liveUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> Open live link</a>}
                  {b.proof.videoUrl && <a className="flex items-center gap-1 underline" href={b.proof.videoUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> Open video</a>}
                </div>
              </>
            )}
          </Card>

          {/* PRASAD */}
          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Truck size={16} /> Prasad delivery</h2><StatusPill tone={PRASAD_STATUS[b.prasad.status].tone}>{PRASAD_STATUS[b.prasad.status].label}</StatusPill></div>
            {b.prasad.status === "not_required" ? <p className="text-sm" style={{ color: "var(--a-faint)" }}>No prasad or product in this booking.</p> : (
              <>
                <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--a-surface-2)", color: "var(--a-fg)" }}>
                  <p className="flex items-center gap-1.5 font-medium"><MapPin size={14} /> Ship to</p>
                  {b.address ? <p style={{ color: "var(--a-muted)" }}>{b.address.name}, {b.address.phone} · {b.address.line1}{b.address.line2 ? `, ${b.address.line2}` : ""}, {b.address.city}, {b.address.state} {b.address.postalCode}</p> : <p className="text-rose-700">No address yet</p>}
                  {!["shipped", "delivered"].includes(b.prasad.status) && !address && <button type="button" onClick={() => setAddress(b.address ?? blankAddress(b))} className="mt-1 text-xs font-medium" style={{ color: "var(--a-gold)" }}>{b.address ? "Change address" : "Add address"}</button>}
                </div>
                {address && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(["name", "phone", "line1", "line2", "city", "state", "postalCode"] as const).map((k) => <AdminInput key={k} value={address[k]} onChange={(e) => setAddress({ ...address, [k]: e.target.value })} placeholder={{ name: "Name", phone: "Mobile", line1: "House, street", line2: "Area, landmark", city: "City", state: "State", postalCode: "PIN code" }[k]} aria-label={k} />)}
                    <div className="flex gap-2 sm:col-span-2"><AdminButton disabled={busy} onClick={() => run({ action: "address", address }, "Address saved")}>Save address</AdminButton><AdminButton variant="ghost" onClick={() => setAddress(null)}>Cancel</AdminButton></div>
                  </div>
                )}
                {b.status !== "cancelled" && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <Field label="Status"><AdminSelectPro value={pr.status} onChange={(e) => setPrasad({ ...pr, status: e.target.value as PrasadStatus })}><option value={b.prasad.status}>{PRASAD_STATUS[b.prasad.status].label} (now)</option>{PRASAD_NEXT[b.prasad.status].map((s) => <option key={s} value={s}>{PRASAD_STATUS[s].label}</option>)}</AdminSelectPro></Field>
                      <Field label="Courier"><AdminInput value={pr.courier} onChange={(e) => setPrasad({ ...pr, courier: e.target.value })} placeholder="Delhivery" /></Field>
                      <Field label="Tracking no."><AdminInput value={pr.trackingNo} onChange={(e) => setPrasad({ ...pr, trackingNo: e.target.value })} /></Field>
                      <Field label="Tracking link"><AdminInput value={pr.trackingUrl} onChange={(e) => setPrasad({ ...pr, trackingUrl: e.target.value })} placeholder="https://" /></Field>
                    </div>
                    <Field label="Note"><AdminInput value={pr.note} onChange={(e) => setPrasad({ ...pr, note: e.target.value.slice(0, 300) })} placeholder="e.g. Parcel damaged, reshipping" /></Field>
                    {prasad && <div className="flex gap-2"><AdminButton disabled={busy} onClick={() => run({ action: "prasad", ...pr }, "Prasad updated")}><Truck size={15} /> Update prasad</AdminButton><AdminButton variant="ghost" onClick={() => setPrasad(null)}>Discard</AdminButton></div>}
                    {pr.status === "shipped" && !["performed", "completed"].includes(b.status) && <p className="text-xs text-amber-700">Prasad can be shipped once the pooja is performed.</p>}
                    <p className="text-[11px]" style={{ color: "var(--a-faint)" }}>{b.prasad.shippedAt ? `Shipped ${fmtWhen(b.prasad.shippedAt)}. ` : ""}{b.prasad.deliveredAt ? `Delivered ${fmtWhen(b.prasad.deliveredAt)}. ` : ""}Dispatch target: {b.policy.prasadDispatchDays} days after the pooja.</p>
                  </>
                )}
              </>
            )}
          </Card>

          {/* TIMELINE */}
          <Card className="space-y-3 p-5">
            <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Timeline</h2>
            <div className="flex gap-2"><AdminInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (call log, customer request…)" onKeyDown={(e) => { if (e.key === "Enter" && note.trim().length >= 2) void run({ action: "note", text: note.trim() }).then((okd) => okd && setNote("")); }} /><AdminButton disabled={busy || note.trim().length < 2} onClick={() => void run({ action: "note", text: note.trim() }).then((okd) => okd && setNote(""))}><Send size={15} /></AdminButton></div>
            <Timeline items={b.timeline.map((t) => ({ title: t.message, time: `${fmtWhen(t.at)} · ${t.actor}`, done: ["created", "payment", "status"].includes(t.type) }))} />
          </Card>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          <Card className="space-y-2 p-5">
            <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Customer</h2>
            <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>{b.customer.name}</p>
            <p className="flex items-center justify-between text-sm" style={{ color: "var(--a-muted)" }}><span className="flex items-center gap-1.5"><Phone size={13} /><a href={`tel:+91${b.customer.phone}`}>{b.customer.phone}</a></span><CopyButton value={b.customer.phone} /></p>
            {b.customer.email && <p className="flex items-center justify-between text-sm" style={{ color: "var(--a-muted)" }}><span className="truncate">{b.customer.email}</span><CopyButton value={b.customer.email} /></p>}
            <p className="text-xs" style={{ color: "var(--a-faint)" }}>Source: {b.source} · booked {fmtWhen(b.createdAt)}</p>
          </Card>

          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between"><h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Pandit</h2>{b.rescheduleCount > 0 && <Badge tone="gold">Rescheduled {b.rescheduleCount}×</Badge>}</div>
            {b.panditName ? <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>{b.panditName}</p> : <p className="text-sm" style={{ color: "var(--a-faint)" }}>Not assigned</p>}
            <div className="flex flex-wrap gap-2">
              {(b.status === "confirmed" || b.status === "assigned") && <AdminButton variant="outline" onClick={() => { setPanditId(b.panditId ?? ""); setCanForce(false); setAsk("assign"); }}><UserCheck size={15} /> {b.panditId ? "Change" : "Assign"}</AdminButton>}
              {b.status === "assigned" && <AdminButton variant="ghost" onClick={() => { setReason(""); setAsk("unassign"); }}><UserMinus size={15} /> Remove</AdminButton>}
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Payment</h2>
            <KeyValueList items={[
              { label: "Package", value: inr(b.pricing.packagePrice) },
              ...(b.pricing.slotDelta ? [{ label: "Date pricing", value: `${b.pricing.slotDelta > 0 ? "+" : ""}${inr(b.pricing.slotDelta)} (incl.)` }] : []),
              ...b.addOns.map((a) => ({ label: `${a.name}${a.qty > 1 ? ` × ${a.qty}` : ""}`, value: inr(a.total) })),
              ...(b.pricing.discount ? [{ label: "Discount", value: `−${inr(b.pricing.discount)}` }] : []),
              { label: "Total", value: <b>{inr(b.pricing.total)}</b> },
              { label: "Method", value: b.payment.method },
              ...(b.payment.reference ? [{ label: "Reference", value: b.payment.reference }] : []),
              ...(b.payment.razorpayPaymentId ? [{ label: "Razorpay", value: <code className="text-xs">{b.payment.razorpayPaymentId}</code> }] : []),
              ...(b.payment.refunded ? [{ label: "Refunded", value: <span className="text-rose-700">{inr(b.payment.refunded)}</span> }] : []),
            ]} />
            {b.payment.refunds.length > 0 && (
              <ul className="space-y-1.5 border-t pt-3 text-xs" style={{ borderColor: "var(--a-border)" }}>
                {b.payment.refunds.map((r) => <li key={r.id} className="flex justify-between gap-2"><span style={{ color: "var(--a-muted)" }}>{fmtWhen(r.at)} · {r.method} · {r.reason}{r.error ? ` · ${r.error}` : ""}</span><span className="flex items-center gap-1.5"><b>{inr(r.amount)}</b><Badge tone={r.status === "processed" ? "green" : r.status === "failed" ? "rose" : "gold"}>{r.status}</Badge></span></li>)}
              </ul>
            )}
            {b.payment.status !== "unpaid" && <p className="text-xs" style={{ color: "var(--a-muted)" }}>Policy today: {refund.pct}% refund ({inr(refund.amount)} of {inr(refund.refundable)} refundable)</p>}
          </Card>

          <Card className="space-y-2 p-5">
            <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Internal notes</h2>
            <AdminTextarea rows={4} value={notes ?? b.adminNotes} onChange={(e) => setNotes(e.target.value.slice(0, 4000))} placeholder="Only admins see this" />
            {notes !== null && notes !== b.adminNotes && <AdminButton disabled={busy} onClick={() => run({ action: "notes", adminNotes: notes }, "Notes saved")}>Save notes</AdminButton>}
          </Card>
        </div>
      </div>

      {/* ---------- dialogs ---------- */}
      <Modal open={ask === "paid"} onClose={() => setAsk(null)} title="Mark as paid" subtitle={`Confirm you received ${inr(b.pricing.total)} outside the website.`} size="sm">
        <div className="space-y-4">
          <Field label="Payment reference" hint="UPI ref, cash receipt no., bank txn id"><AdminInput value={reference} onChange={(e) => setReference(e.target.value.slice(0, 120))} /></Field>
          <AdminButton className="w-full" disabled={busy || reference.trim().length < 3} onClick={() => run({ action: "mark_paid", reference }, "Marked paid")}>Confirm payment</AdminButton>
        </div>
      </Modal>

      <Modal open={ask === "assign"} onClose={() => setAsk(null)} title="Assign a pandit" subtitle={fmtSlot(b.slot.date, b.slot.time)} size="sm">
        <div className="space-y-4">
          <Field label="Pandit">
            <AdminSelectPro value={panditId} onChange={(e) => { setPanditId(e.target.value); setCanForce(false); }}>
              <option value="">Choose…</option>
              {pandits.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}{x.city ? ` · ${x.city}` : ""}{x.poojaIds.length && !x.poojaIds.includes(b.poojaId) ? " · not set up for this pooja" : ""}</option>)}
            </AdminSelectPro>
          </Field>
          {pandits.length === 0 && <p className="text-sm" style={{ color: "var(--a-muted)" }}>No pandits yet. <Link className="underline" href="/admin/poojas/pandits">Add pandits</Link></p>}
          {selectedPandit && <p className="text-xs" style={{ color: "var(--a-muted)" }}>Limit {selectedPandit.maxPerDay} poojas a day · {selectedPandit.languages.join(", ") || "languages not set"}</p>}
          {canForce && <p className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> This goes over the pandit&apos;s limit or setup. Assign anyway only if you have checked with them.</p>}
          <AdminButton className="w-full" disabled={busy || !panditId} onClick={() => run({ action: "assign", panditId, force: canForce }, "Pandit assigned")}>{canForce ? "Assign anyway" : "Assign"}</AdminButton>
        </div>
      </Modal>

      <Modal open={ask === "unassign"} onClose={() => setAsk(null)} title={`Remove ${b.panditName}?`} size="sm">
        <div className="space-y-4">
          <Field label="Reason"><AdminTextarea rows={2} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} placeholder="Pandit unwell" /></Field>
          <AdminButton className="w-full" variant="danger" disabled={busy || reason.trim().length < 5} onClick={() => run({ action: "unassign", reason }, "Pandit removed")}>Remove pandit</AdminButton>
        </div>
      </Modal>

      <Modal open={ask === "reopen"} onClose={() => setAsk(null)} title="Reopen booking?" subtitle="Moves it back to Performed." size="sm">
        <div className="space-y-4">
          <Field label="Reason"><AdminTextarea rows={2} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} placeholder="Customer says the video link does not open" /></Field>
          <AdminButton className="w-full" disabled={busy || reason.trim().length < 5} onClick={() => run({ action: "reopen", reason }, "Reopened")}>Reopen</AdminButton>
        </div>
      </Modal>

      <Modal open={ask === "reschedule"} onClose={() => setAsk(null)} title="Reschedule" subtitle={`Now: ${fmtSlot(b.slot.date, b.slot.time)} · rescheduled ${b.rescheduleCount}/${b.policy.maxReschedules} times by policy`} size="md">
        <div className="space-y-4">
          <Field label="New slot">
            <AdminSelectPro value={slotKey} onChange={(e) => setSlotKey(e.target.value)}>
              <option value="">Choose…</option>
              {slots.map((s) => <option key={s.key} value={s.key}>{fmtSlot(s.date, s.time)}{s.label ? ` · ${s.label}` : ""} · {s.left}/{s.capacity} left{s.closed ? " · closed" : ""}</option>)}
            </AdminSelectPro>
          </Field>
          {slots.length === 0 && <p className="text-xs" style={{ color: "var(--a-muted)" }}>No other slots in the next 60 days.</p>}
          {pickedSlot && pickedSlot.left <= 0 && <Toggle checked={overbook} onChange={setOverbook} label="Slot is full: allow overbooking" />}
          {pickedSlot?.closed && <Toggle checked={ignoreCutoff} onChange={setIgnoreCutoff} label="Booking closed for this slot: move anyway" />}
          {pickedSlot && pickedSlot.date !== b.slot.date && b.panditName && <p className="text-xs text-amber-700">The date changes, so {b.panditName} will be removed. Assign a pandit again after moving.</p>}
          {pickedSlot && pickedSlot.priceDelta !== 0 && <p className="text-xs" style={{ color: "var(--a-muted)" }}>That date has different pricing. The customer&apos;s price stays the same.</p>}
          <Field label="Reason (shown in the timeline)"><AdminTextarea rows={2} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} placeholder="Customer requested" /></Field>
          <AdminButton className="w-full" disabled={busy || !pickedSlot || reason.trim().length < 5 || (pickedSlot.left <= 0 && !overbook) || (pickedSlot.closed && !ignoreCutoff)}
            onClick={() => pickedSlot && run({ action: "reschedule", date: pickedSlot.date, time: pickedSlot.time, reason, allowOverbook: overbook, ignoreCutoff }, "Rescheduled")}>Move booking</AdminButton>
        </div>
      </Modal>

      <Modal open={ask === "cancel" || ask === "refund"} onClose={() => setAsk(null)} title={ask === "cancel" ? "Cancel booking" : "Refund"} subtitle={ask === "cancel" ? "The seat is released. Pandit is removed." : `Up to ${inr(refund.refundable)} can be refunded.`} size="md">
        <div className="space-y-4">
          {b.payment.status !== "unpaid" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Refund amount (₹)" hint={ask === "cancel" ? `Policy suggests ${inr(refund.amount)} (${refund.pct}%)` : `Max ${inr(refund.refundable)}`}><AdminInput inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 8))} /></Field>
                <Field label="Refund via">
                  <AdminSelectPro value={method} onChange={(e) => setMethod(e.target.value as "razorpay" | "manual")}>
                    <option value="manual">Manual (UPI / bank / cash)</option>
                    <option value="razorpay" disabled={b.payment.method !== "razorpay" || !b.payment.razorpayPaymentId}>Razorpay (to original payment)</option>
                  </AdminSelectPro>
                </Field>
              </div>
              {method === "manual" && amt > 0 && <Field label="Refund reference" hint="UPI / bank transaction id"><AdminInput value={reference} onChange={(e) => setReference(e.target.value.slice(0, 120))} /></Field>}
              {!amtOk && amount !== "" && <p className="text-xs text-rose-700">Enter a whole amount {ask === "cancel" ? "from ₹0" : "from ₹1"} up to {inr(refund.refundable)}.</p>}
            </>
          ) : <p className="text-sm" style={{ color: "var(--a-muted)" }}>Not paid, so nothing to refund.</p>}
          <Field label="Reason (shown in the timeline and audit log)"><AdminTextarea rows={2} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} placeholder={ask === "cancel" ? "Customer request / pandit unavailable / duplicate booking" : "Prasad lost in transit"} /></Field>
          <AdminButton className="w-full" variant={ask === "cancel" ? "danger" : "primary"}
            disabled={busy || reason.trim().length < 5 || (b.payment.status !== "unpaid" && (!amtOk || (method === "manual" && amt > 0 && reference.trim().length < 3)))}
            onClick={() => ask === "cancel"
              ? run({ action: "cancel", reason, refundAmount: b.payment.status === "unpaid" ? 0 : amt, refundMethod: method, reference, requestId }, "Booking cancelled")
              : run({ action: "refund", amount: amt, reason, method, reference, requestId }, "Refund done")}>
            {ask === "cancel" ? (amt > 0 && b.payment.status !== "unpaid" ? `Cancel and refund ${inr(amt)}` : "Cancel booking") : `Refund ${amtOk ? inr(amt) : ""}`}
          </AdminButton>
          <p className="text-[11px]" style={{ color: "var(--a-faint)" }}>Refunds need the delete permission on Poojas. A double click is applied once.</p>
        </div>
      </Modal>
    </div>
  );
}
