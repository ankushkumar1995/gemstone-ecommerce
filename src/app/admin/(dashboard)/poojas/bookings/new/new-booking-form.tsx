"use client";

/**
 * Admin booking (phone, walk-in, complimentary). Same rules as a customer
 * booking: live slot capacity, package name limit, add-on limits, address for
 * delivery, sankalp form rules. Admin-only switches (overbook, ignore cutoff)
 * are explicit and written to the timeline. The request id makes a double
 * submit create one booking.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { newRequestId, poojaAdminApi } from "@/lib/admin-pooja-api";
import type { Pooja, PoojaListItem, SankalpMember, ShippingAddress, SlotView } from "@/modules/poojas/pooja.types";
import { AdminBreadcrumb, AdminButton, AdminInput, AdminSelectPro, AdminTextarea, Card, Field, PageHeader, Toggle, useAdminToast, useOnMount } from "../../../../_components";
import { fmtSlot, inr } from "../../pooja-meta";

const blankMember = (): SankalpMember => ({ name: "", relation: "", gotra: "", dob: "", birthPlace: "" });

export function NewBookingForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useAdminToast();
  const [poojas, setPoojas] = useState<PoojaListItem[]>([]);
  const [poojaId, setPoojaId] = useState(sp.get("poojaId") ?? "");
  const [pooja, setPooja] = useState<Pooja | null>(null);
  const [slots, setSlots] = useState<SlotView[]>([]);
  const [packageId, setPackageId] = useState("");
  const [slotKey, setSlotKey] = useState("");
  const [addOns, setAddOns] = useState<Record<string, number>>({});
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [members, setMembers] = useState<SankalpMember[]>([blankMember()]);
  const [wish, setWish] = useState("");
  const [address, setAddress] = useState<ShippingAddress>({ name: "", phone: "", line1: "", line2: "", city: "", state: "", postalCode: "" });
  const [pay, setPay] = useState<{ method: "manual" | "free"; paid: boolean; reference: string }>({ method: "manual", paid: true, reference: "" });
  const [discount, setDiscount] = useState("0");
  const [overbook, setOverbook] = useState(false);
  const [ignoreCutoff, setIgnoreCutoff] = useState(false);
  const [requestId] = useState(newRequestId);
  const [busy, setBusy] = useState(false);

  useOnMount(async () => {
    const r = await poojaAdminApi.poojas.list();
    if (r.ok) setPoojas(r.data.filter((p) => p.status === "active" || p.status === "paused"));
  });

  useEffect(() => {
    if (!poojaId) return;
    let alive = true;
    void Promise.all([poojaAdminApi.poojas.get(poojaId), poojaAdminApi.poojas.availability(poojaId, undefined, 90)]).then(([p, s]) => {
      if (!alive) return;
      if (p.ok) { setPooja(p.data); setPackageId(p.data.packages.find((x) => x.active && x.popular)?.id ?? p.data.packages.find((x) => x.active)?.id ?? ""); setAddOns({}); }
      setSlots(s.ok ? s.data : []);
      setSlotKey("");
    });
    return () => { alive = false; };
  }, [poojaId]);

  const pkg = pooja?.packages.find((x) => x.id === packageId);
  const slot = slots.find((s) => s.key === slotKey);
  const chosen = useMemo(() => (pooja?.addOns ?? []).filter((a) => a.active && (addOns[a.id] ?? 0) > 0), [pooja, addOns]);
  const needsAddress = chosen.some((a) => a.requiresAddress);
  const packagePrice = pkg ? Math.max(0, pkg.price + (slot?.priceDelta ?? 0)) : 0;
  const addOnsTotal = chosen.reduce((s, a) => s + a.price * (addOns[a.id] ?? 0), 0);
  const subtotal = packagePrice + addOnsTotal;
  const disc = pay.method === "free" ? subtotal : Number(discount) || 0;
  const total = Math.max(0, subtotal - disc);

  const problems = [
    !pooja ? "Choose a pooja" : "",
    !pkg ? "Choose a package" : "",
    !slot ? "Choose a date" : "",
    slot && slot.left <= 0 && !overbook ? "The slot is full (allow overbooking to continue)" : "",
    slot?.closed && !ignoreCutoff ? "Booking for this slot has closed (ignore cutoff to continue)" : "",
    customer.name.trim().length < 2 ? "Customer name" : "",
    !/^[6-9]\d{9}$/.test(customer.phone) ? "10-digit mobile" : "",
    members.some((m) => m.name.trim().length < 2) ? "Every sankalp name" : "",
    pkg && members.length > pkg.members ? `Package allows ${pkg.members} names` : "",
    pooja?.sankalp.requireWish && wish.trim().length < 3 ? "Sankalp (wish)" : "",
    pooja?.sankalp.requireDob && members.some((m) => !m.dob) ? "Date of birth for every name" : "",
    needsAddress && (!address.line1.trim() || !/^[1-9]\d{5}$/.test(address.postalCode) || !address.city.trim() || !/^[6-9]\d{9}$/.test(address.phone)) ? "Complete delivery address" : "",
    pay.method === "manual" && pay.paid && pay.reference.trim().length < 3 ? "Payment reference" : "",
    disc > subtotal ? "Discount is more than the total" : "",
  ].filter(Boolean);

  const submit = async () => {
    if (problems.length || !slot || !pooja) return;
    setBusy(true);
    const r = await poojaAdminApi.bookings.create({
      poojaId: pooja.id, packageId, date: slot.date, time: slot.time,
      addOns: chosen.map((a) => ({ id: a.id, qty: addOns[a.id] })),
      customer: { name: customer.name.trim(), email: customer.email.trim(), phone: customer.phone },
      members, wish, address: needsAddress ? address : null,
      payment: pay, discount: pay.method === "free" ? 0 : disc, allowOverbook: overbook, ignoreCutoff, requestId,
    });
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    toast(`Booking ${r.data.bookingNumber} created`, "success");
    router.replace(`/admin/poojas/bookings/${r.data.id}`);
  };

  return (
    <div className="pb-16">
      <AdminBreadcrumb items={[{ label: "Poojas", href: "/admin/poojas" }, { label: "Bookings", href: "/admin/poojas/bookings" }, { label: "New booking" }]} />
      <div className="mt-3"><PageHeader title="New pooja booking" subtitle="For phone, walk-in or complimentary bookings." /></div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Pooja</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pooja"><AdminSelectPro value={poojaId} onChange={(e) => setPoojaId(e.target.value)}><option value="">Choose…</option>{poojas.map((p) => <option key={p.id} value={p.id}>{p.title}{p.status === "paused" ? " (paused)" : ""}</option>)}</AdminSelectPro></Field>
              <Field label="Package"><AdminSelectPro value={packageId} onChange={(e) => setPackageId(e.target.value)} disabled={!pooja}>{pooja?.packages.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name} · {inr(x.price)} · {x.members} name{x.members > 1 ? "s" : ""}</option>)}</AdminSelectPro></Field>
            </div>
            <Field label="Date" hint={pooja ? `${slots.length} slots in the next 90 days` : ""}>
              <AdminSelectPro value={slotKey} onChange={(e) => { setSlotKey(e.target.value); setOverbook(false); setIgnoreCutoff(false); }} disabled={!pooja}>
                <option value="">Choose…</option>
                {slots.map((s) => <option key={s.key} value={s.key}>{fmtSlot(s.date, s.time)}{s.label ? ` · ${s.label}` : ""} · {s.left}/{s.capacity} left{s.closed ? " · closed" : ""}{s.priceDelta ? ` · ${s.priceDelta > 0 ? "+" : ""}${inr(s.priceDelta)}` : ""}</option>)}
              </AdminSelectPro>
            </Field>
            {slot && slot.left <= 0 && <Toggle checked={overbook} onChange={setOverbook} label="Slot is full: allow overbooking (logged)" />}
            {slot?.closed && <Toggle checked={ignoreCutoff} onChange={setIgnoreCutoff} label="Booking closed: book anyway (logged)" />}
            {pooja && pooja.addOns.some((a) => a.active) && (
              <Field label="Add-ons">
                <div className="space-y-2">
                  {pooja.addOns.filter((a) => a.active).map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
                      <span>{a.name} · {inr(a.price)}{a.requiresAddress ? " · needs address" : ""}</span>
                      <AdminSelectPro value={addOns[a.id] ?? 0} onChange={(e) => setAddOns({ ...addOns, [a.id]: Number(e.target.value) })} className="w-20" aria-label={`${a.name} quantity`}>
                        {Array.from({ length: Math.min(a.maxQty, 20) + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
                      </AdminSelectPro>
                    </div>
                  ))}
                </div>
              </Field>
            )}
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Customer</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Name"><AdminInput value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value.slice(0, 80) })} /></Field>
              <Field label="Mobile"><AdminInput inputMode="numeric" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value.replace(/\D/g, "").slice(-10) })} /></Field>
              <Field label="Email (optional)"><AdminInput type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value.slice(0, 120) })} /></Field>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Sankalp {pkg ? `(${members.length}/${pkg.members})` : ""}</h2>
            {pooja?.sankalp.instructions && <p className="text-xs" style={{ color: "var(--a-muted)" }}>{pooja.sankalp.instructions}</p>}
            {members.map((m, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_8rem_8rem_9rem_auto]">
                <AdminInput value={m.name} onChange={(e) => setMembers(members.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} placeholder="Full name" aria-label="Name" />
                <AdminInput value={m.relation} onChange={(e) => setMembers(members.map((x, k) => (k === i ? { ...x, relation: e.target.value } : x)))} placeholder="Relation" aria-label="Relation" />
                <AdminInput value={m.gotra} onChange={(e) => setMembers(members.map((x, k) => (k === i ? { ...x, gotra: e.target.value } : x)))} placeholder={pooja?.sankalp.defaultGotra || "Gotra"} aria-label="Gotra" />
                <AdminInput type="date" value={m.dob} onChange={(e) => setMembers(members.map((x, k) => (k === i ? { ...x, dob: e.target.value } : x)))} aria-label="Date of birth" />
                {members.length > 1 ? <button type="button" aria-label="Remove name" onClick={() => setMembers(members.filter((_, k) => k !== i))} className="text-rose-600"><Trash2 size={15} /></button> : <span />}
              </div>
            ))}
            {(!pkg || members.length < pkg.members) && <button type="button" onClick={() => setMembers([...members, blankMember()])} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--a-gold)" }}><Plus size={13} /> Add name</button>}
            <Field label="Sankalp (wish)"><AdminTextarea rows={2} value={wish} onChange={(e) => setWish(e.target.value.slice(0, pooja?.sankalp.wishMaxLength ?? 2000))} /></Field>
          </Card>

          {needsAddress && (
            <Card className="space-y-4 p-5">
              <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Delivery address</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["name", "phone", "line1", "line2", "city", "state", "postalCode"] as const).map((k) => <AdminInput key={k} value={address[k]} onChange={(e) => setAddress({ ...address, [k]: k === "phone" || k === "postalCode" ? e.target.value.replace(/\D/g, "").slice(0, k === "phone" ? 10 : 6) : e.target.value })} placeholder={{ name: "Name", phone: "Mobile", line1: "House, street", line2: "Area, landmark", city: "City", state: "State", postalCode: "PIN code" }[k]} aria-label={k} />)}
              </div>
              <button type="button" className="text-xs font-medium" style={{ color: "var(--a-gold)" }} onClick={() => setAddress({ ...address, name: customer.name, phone: customer.phone })}>Same name and mobile as the customer</button>
            </Card>
          )}
        </div>

        <aside>
          <Card className="sticky top-24 space-y-4 p-5">
            <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Payment</h2>
            <Field label="Type">
              <AdminSelectPro value={pay.method === "free" ? "free" : pay.paid ? "paid" : "unpaid"} onChange={(e) => setPay(e.target.value === "free" ? { method: "free", paid: true, reference: pay.reference } : { method: "manual", paid: e.target.value === "paid", reference: pay.reference })}>
                <option value="paid">Paid offline (UPI / cash / bank)</option><option value="unpaid">Not paid yet</option><option value="free">Complimentary (free)</option>
              </AdminSelectPro>
            </Field>
            {pay.method === "manual" && pay.paid && <Field label="Payment reference"><AdminInput value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value.slice(0, 120) })} /></Field>}
            {pay.method !== "free" && <Field label="Discount (₹)"><AdminInput inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/\D/g, "").slice(0, 8))} /></Field>}
            <dl className="space-y-1 border-t pt-3 text-sm" style={{ borderColor: "var(--a-border)" }}>
              <div className="flex justify-between"><dt style={{ color: "var(--a-muted)" }}>Package</dt><dd>{inr(packagePrice)}</dd></div>
              {chosen.map((a) => <div key={a.id} className="flex justify-between"><dt style={{ color: "var(--a-muted)" }}>{a.name} × {addOns[a.id]}</dt><dd>{inr(a.price * addOns[a.id])}</dd></div>)}
              {disc > 0 && <div className="flex justify-between"><dt style={{ color: "var(--a-muted)" }}>Discount</dt><dd>−{inr(Math.min(disc, subtotal))}</dd></div>}
              <div className="flex justify-between border-t pt-2 font-semibold" style={{ borderColor: "var(--a-border)" }}><dt>Total</dt><dd>{inr(total)}</dd></div>
            </dl>
            {problems.length > 0 && <ul className="space-y-0.5 text-xs text-rose-700">{problems.map((p) => <li key={p}>• {p}</li>)}</ul>}
            <AdminButton className="w-full" disabled={busy || problems.length > 0} onClick={submit}>{busy ? "Creating…" : "Create booking"}</AdminButton>
            <Link href="/admin/poojas/bookings" className="block text-center text-xs" style={{ color: "var(--a-muted)" }}>Cancel</Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
