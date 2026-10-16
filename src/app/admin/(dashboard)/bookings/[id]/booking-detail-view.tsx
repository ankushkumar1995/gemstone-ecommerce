"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarClock, Save, Send, User, Phone, Mail, MapPin, Clock, Sparkles } from "lucide-react";
import type { Booking, BookingStatus } from "@/modules/bookings";
import { adminApi } from "@/lib/admin-api";
import { formatPrice } from "@/lib/utils";
import {
  Card,
  AdminButton,
  AdminInput,
  AdminTextarea,
  Avatar,
  StatusPill,
  Timeline,
  KeyValueList,
  TableSkeleton,
  EmptyState,
  useAdminToast,
} from "@/app/admin/_components";
import { B_STATUS_META, B_PAYMENT_META, B_NEXT_STATUSES } from "../booking-status";

/** ISO → datetime-local input value. */
function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BookingDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [note, setNote] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const load = async () => {
    const res = await adminApi.bookings.get(id);
    if (res.ok) {
      setBooking(res.data);
      setScheduledAt(toLocalInput(res.data.scheduledAt));
      setAdminNotes(res.data.adminNotes ?? "");
      setState("ok");
    } else setState("missing");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (state === "loading") return <TableSkeleton rows={6} cols={2} />;
  if (state === "missing" || !booking)
    return <EmptyState title="Booking not found" message="This booking may have been removed." />;

  const b = booking;
  const nexts = B_NEXT_STATUSES[b.status];

  const changeStatus = async (status: BookingStatus) => {
    const res = await adminApi.bookings.updateStatus(b.id, status);
    if (res.ok) {
      setBooking(res.data);
      toast(`Status → ${B_STATUS_META[status].label}`, "success");
    } else toast(res.message, "error");
  };

  const markPayment = async (ps: "paid" | "unpaid" | "refunded") => {
    const res = await adminApi.bookings.updatePayment(b.id, ps);
    if (res.ok) {
      setBooking(res.data);
      toast(`Payment marked ${ps}`, "success");
    } else toast(res.message, "error");
  };

  const saveSchedule = async () => {
    if (!scheduledAt) return toast("Pick a date & time", "error");
    const res = await adminApi.bookings.schedule(b.id, new Date(scheduledAt).toISOString());
    if (res.ok) {
      setBooking(res.data);
      toast("Appointment scheduled", "success");
    } else toast(res.message, "error");
  };

  const saveNotes = async () => {
    const res = await adminApi.bookings.setAdminNotes(b.id, adminNotes);
    if (res.ok) {
      setBooking(res.data);
      toast("Notes saved", "success");
    } else toast(res.message, "error");
  };

  const addNote = async () => {
    if (!note.trim()) return;
    const res = await adminApi.bookings.addNote(b.id, note.trim());
    if (res.ok) {
      setBooking(res.data);
      setNote("");
      toast("Note added", "success");
    } else toast(res.message, "error");
  };

  return (
    <div>
      {/* header */}
      <button
        onClick={() => router.push("/admin/bookings")}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium"
        style={{ color: "var(--a-muted)" }}
      >
        <ArrowLeft size={15} /> Back to bookings
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--a-gold-soft)] text-[var(--a-gold)]">
            <Sparkles size={20} />
          </span>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--a-fg)" }}>{b.serviceTitle}</h1>
            <p className="text-sm" style={{ color: "var(--a-faint)" }}>
              {b.bookingNumber} · {new Date(b.placedAt).toLocaleString("en-IN")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill tone={B_STATUS_META[b.status].tone}>{B_STATUS_META[b.status].label}</StatusPill>
          <StatusPill tone={B_PAYMENT_META[b.paymentStatus].tone}>{B_PAYMENT_META[b.paymentStatus].label}</StatusPill>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* left — details */}
        <div className="space-y-6">
          {/* status actions */}
          {nexts.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Update status</h2>
              <div className="flex flex-wrap gap-2">
                {nexts.map((s) => (
                  <AdminButton
                    key={s}
                    variant={s === "cancelled" || s === "refunded" ? "outline" : "primary"}
                    onClick={() => changeStatus(s)}
                  >
                    Mark {B_STATUS_META[s].label} <ArrowRight size={14} />
                  </AdminButton>
                ))}
              </div>
            </Card>
          )}

          {/* intake / birth details */}
          <Card>
            <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Consultation details</h2>
            <KeyValueList
              items={[
                { label: "Full name", value: b.intake.fullName },
                { label: "Phone", value: b.intake.phone || "—" },
                { label: "Date of birth", value: b.intake.dob || "—" },
                { label: "Time of birth", value: b.intake.birthTime || "—" },
                { label: "Place of birth", value: b.intake.birthPlace || "—" },
                { label: "Gender", value: b.intake.gender || "—" },
                {
                  label: "Preferred time",
                  value: b.preferredAt ? new Date(b.preferredAt).toLocaleString("en-IN") : "—",
                },
              ]}
            />
            {b.intake.message && (
              <div className="mt-4 rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
                <p className="mb-1 text-xs font-medium" style={{ color: "var(--a-faint)" }}>Question / concern</p>
                <p className="text-sm" style={{ color: "var(--a-fg)" }}>{b.intake.message}</p>
              </div>
            )}
          </Card>

          {/* schedule */}
          <Card>
            <h2 className="mb-3 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}>
              <CalendarClock size={17} /> Appointment
            </h2>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[14rem]">
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-[var(--a-gold)]"
                  style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
                />
              </div>
              <AdminButton onClick={saveSchedule}>
                <Save size={14} /> Save
              </AdminButton>
            </div>
            {b.scheduledAt && (
              <p className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: "var(--a-muted)" }}>
                <Clock size={12} /> Currently scheduled: {new Date(b.scheduledAt).toLocaleString("en-IN")}
              </p>
            )}
          </Card>

          {/* admin notes (shared with customer) */}
          <Card>
            <h2 className="mb-1 font-semibold" style={{ color: "var(--a-fg)" }}>Notes for customer</h2>
            <p className="mb-3 text-xs" style={{ color: "var(--a-faint)" }}>
              Shown on the customer&apos;s booking (delivery link, instructions, report notes).
            </p>
            <AdminTextarea rows={3} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="e.g. Your report is ready: <link>, or call scheduled details…" />
            <AdminButton className="mt-3" onClick={saveNotes}>
              <Save size={14} /> Save notes
            </AdminButton>
          </Card>

          {/* timeline */}
          <Card>
            <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Activity</h2>
            <div className="mb-4 flex gap-2">
              <AdminInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" />
              <AdminButton onClick={addNote}>
                <Send size={14} />
              </AdminButton>
            </div>
            <Timeline
              items={b.activity.map((a) => ({
                title: a.actor ? `${a.message} · ${a.actor}` : a.message,
                time: new Date(a.at).toLocaleString("en-IN"),
              }))}
            />
          </Card>
        </div>

        {/* right — customer + payment */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Customer</h2>
            <div className="flex items-center gap-3">
              <Avatar name={b.customer.name} size={40} />
              <div className="min-w-0">
                <p className="truncate font-medium" style={{ color: "var(--a-fg)" }}>{b.customer.name}</p>
                <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>{b.customer.email}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm" style={{ color: "var(--a-muted)" }}>
              <p className="flex items-center gap-2"><Mail size={14} /> {b.customer.email}</p>
              <p className="flex items-center gap-2"><Phone size={14} /> {b.customer.phone || b.intake.phone || "—"}</p>
              <p className="flex items-center gap-2"><User size={14} /> {b.intake.fullName}</p>
              {b.intake.birthPlace && (
                <p className="flex items-center gap-2"><MapPin size={14} /> {b.intake.birthPlace}</p>
              )}
            </div>
            {b.customerId && (
              <AdminButton variant="outline" className="mt-4 w-full" onClick={() => router.push(`/admin/customers/${b.customerId}`)}>
                View customer
              </AdminButton>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Payment</h2>
            <KeyValueList
              items={[
                { label: "Amount", value: <span className="font-semibold">{formatPrice(b.amount)}</span> },
                { label: "Method", value: b.paymentMethod },
                { label: "Status", value: <StatusPill tone={B_PAYMENT_META[b.paymentStatus].tone}>{B_PAYMENT_META[b.paymentStatus].label}</StatusPill> },
                ...(b.payment?.razorpayPaymentId
                  ? [{ label: "Txn", value: <code className="text-xs">{b.payment.razorpayPaymentId}</code> }]
                  : []),
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {b.paymentStatus !== "paid" && (
                <AdminButton variant="outline" onClick={() => markPayment("paid")}>Mark paid</AdminButton>
              )}
              {b.paymentStatus === "paid" && (
                <AdminButton variant="outline" onClick={() => markPayment("refunded")}>Mark refunded</AdminButton>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
