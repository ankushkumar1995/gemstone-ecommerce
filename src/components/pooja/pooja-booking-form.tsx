"use client";

/**
 * Pooja booking request form (no payment). The request is saved as a pooja
 * booking with "payment pending"; the team calls to confirm.
 *
 * Mirrors the server rules so problems show before sending: members per
 * package, sankalp settings (gotra / DOB / birth place / wish), add-on
 * limits, delivery address when prasad is chosen, 10-digit mobile.
 * A request id is kept per attempt, so a double click or retry creates one
 * booking only. Errors show under each field; the first one is scrolled to.
 */

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  AlertCircle, ArrowRight, CalendarDays, Check, CheckCircle2, Loader2, Lock, Minus, PhoneCall, Plus, RefreshCw, Trash2, UserPlus, Users,
} from "lucide-react";
import type { PublicPooja, SlotView } from "@/modules/poojas/pooja.types";
import { shopApi } from "@/lib/shop-api";
import { useCommerce } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { useToast } from "@/lib/toast";
import { useStoreSettings, phoneDigits } from "@/lib/store-settings";
import { Button } from "@/components/ui/button";
import { SelectField, fieldBase, fieldOk, fieldBad } from "@/components/ui/select-field";
import { fmtDay, fmtTime, ritualOf } from "@/components/pooja/pooja-ui";
import { TierLine } from "@/components/pooja/havan-info";
import { cn } from "@/lib/utils";

type Member = { name: string; relation: string; gotra: string; dob: string; birthPlace: string };
type Errors = Record<string, string>;
const blankMember = (): Member => ({ name: "", relation: "", gotra: "", dob: "", birthPlace: "" });
const RELATIONS = ["Self", "Spouse", "Son", "Daughter", "Father", "Mother", "Brother", "Sister", "Other"].map((r) => ({ value: r, label: r }));
const newRequestId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : `${Date.now()}${Math.random().toString(36).slice(2, 12)}`).slice(0, 40);
/** "+91 98765-43210" → "9876543210". */
const tenDigits = (v: string) => { const d = v.replace(/\D/g, ""); return d.length === 12 && d.startsWith("91") ? d.slice(2) : d.length === 11 && d.startsWith("0") ? d.slice(1) : d; };
const SLOT_PAGE = 18;

export function PoojaBookingForm({ pooja, packageId, onPackageChange }: { pooja: PublicPooja; packageId: string; onPackageChange: (id: string) => void }) {
  const { user } = useCommerce();
  const { format } = useCurrency();
  const { toast } = useToast();
  const store = useStoreSettings();
  const reduce = useReducedMotion();
  const uid = useId();
  const fid = (k: string) => `${uid}-${k.replace(/\./g, "-")}`;
  const cfg = pooja.sankalp;
  const R = ritualOf(pooja);

  const pkg = pooja.packages.find((p) => p.id === packageId) ?? pooja.packages[0];

  /* ---------- slots ---------- */
  const [slots, setSlots] = useState<SlotView[] | null>(null);
  const [slotsError, setSlotsError] = useState("");
  const [slotKey, setSlotKey] = useState("");
  const [slotLimit, setSlotLimit] = useState(SLOT_PAGE);
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    let alive = true;
    shopApi.poojas.slots(pooja.slug).then((r) => {
      if (!alive) return;
      if (r.ok) { setSlots(r.data); setSlotsError(""); }
      else { setSlots([]); setSlotsError(r.message); }
    });
    return () => { alive = false; };
  }, [pooja.slug, reloadTick]);
  const reloadSlots = () => { setSlots(null); setSlotKey(""); setReloadTick((t) => t + 1); };
  const slot = slots?.find((s) => s.key === slotKey) ?? null;

  /* ---------- form ---------- */
  const [members, setMembers] = useState<Member[]>(() => [{ ...blankMember(), name: user?.name ?? "", relation: cfg.askRelation ? "Self" : "" }]);
  const [wish, setWish] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [contact, setContact] = useState({ name: user?.name ?? "", phone: user?.phone ?? "", email: user?.email ?? "" });
  const [addr, setAddr] = useState({ name: "", phone: "", line1: "", line2: "", city: "", state: "", postalCode: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState("");
  const [sending, setSending] = useState(false);
  const [requestId, setRequestId] = useState(newRequestId);
  const [done, setDone] = useState<null | { bookingNumber: string; date: string; time: string; label: string; total: number }>(null);

  const clearErr = (...keys: string[]) => {
    if (keys.some((k) => errors[k])) setErrors((e) => { const n = { ...e }; keys.forEach((k) => delete n[k]); return n; });
  };

  const choosePackage = (id: string) => {
    const next = pooja.packages.find((p) => p.id === id);
    if (!next) return;
    onPackageChange(id);
    // Keep only as many names as the new package allows.
    setMembers((m) => m.slice(0, next.members));
    clearErr("members");
  };

  const chosenAddOns = pooja.addOns.filter((a) => (qty[a.id] ?? 0) > 0);
  const needsAddress = chosenAddOns.some((a) => a.requiresAddress);
  const pricing = useMemo(() => {
    const base = Math.max(0, pkg.price + (slot?.priceDelta ?? 0));
    const addOns = chosenAddOns.reduce((s, a) => s + a.price * (qty[a.id] ?? 0), 0);
    return { base, addOns, total: base + addOns };
  }, [pkg, slot, chosenAddOns, qty]);

  /* ---------- validation ---------- */
  const validate = (): Errors => {
    const e: Errors = {};
    if (!slot) e.slot = `Please choose a date for the ${R.lower}`;
    members.forEach((m, i) => {
      if (m.name.trim().length < 2) e[`members.${i}.name`] = "Enter the full name";
      if (cfg.requireDob && !m.dob) e[`members.${i}.dob`] = "Date of birth is required";
      if (m.dob && new Date(m.dob).getTime() > Date.now()) e[`members.${i}.dob`] = "Date of birth can't be in the future";
      if (cfg.requireBirthPlace && m.birthPlace.trim().length < 2) e[`members.${i}.birthPlace`] = "Birth place is required";
    });
    if (members.length > pkg.members) e.members = `This package allows ${pkg.members} name${pkg.members > 1 ? "s" : ""}`;
    const w = wish.trim();
    if (cfg.requireWish && w.length < 3) e.wish = "Please write your sankalp (wish)";
    if (w.length > cfg.wishMaxLength) e.wish = `Sankalp can be at most ${cfg.wishMaxLength} characters`;
    if (contact.name.trim().length < 2) e["contact.name"] = "Please enter your full name";
    if (!/^[6-9]\d{9}$/.test(tenDigits(contact.phone))) e["contact.phone"] = "Enter a valid 10-digit mobile number";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) e["contact.email"] = "Enter a valid email address";
    if (needsAddress) {
      if (addr.name.trim().length < 2) e["addr.name"] = "Enter the receiver's name";
      if (!/^[6-9]\d{9}$/.test(tenDigits(addr.phone))) e["addr.phone"] = "Enter a 10-digit mobile number";
      if (addr.line1.trim().length < 4) e["addr.line1"] = "Enter the house / street address";
      if (addr.city.trim().length < 2) e["addr.city"] = "Enter the city";
      if (addr.state.trim().length < 2) e["addr.state"] = "Enter the state";
      if (!/^[1-9]\d{5}$/.test(addr.postalCode.trim())) e["addr.postalCode"] = "Enter a 6-digit PIN code";
    }
    return e;
  };
  const ORDER = ["slot", "members", ...members.flatMap((_, i) => [`members.${i}.name`, `members.${i}.dob`, `members.${i}.birthPlace`]), "wish", "contact.name", "contact.phone", "contact.email", "addr.name", "addr.phone", "addr.line1", "addr.city", "addr.state", "addr.postalCode"];

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (sending) return;
    setServerError("");
    const found = validate();
    setErrors(found);
    const first = ORDER.find((k) => found[k]);
    if (first) {
      const el = document.getElementById(fid(first));
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => el?.focus({ preventScroll: true }), 220);
      return;
    }
    if (!slot) return;
    setSending(true);
    const res = await shopApi.poojas.book({
      poojaId: pooja.id,
      packageId: pkg.id,
      date: slot.date,
      time: slot.time,
      addOns: chosenAddOns.map((a) => ({ id: a.id, qty: qty[a.id] })),
      customer: { name: contact.name.trim(), email: contact.email.trim(), phone: tenDigits(contact.phone) },
      members: members.map((m) => ({ name: m.name.trim(), relation: m.relation, gotra: m.gotra.trim(), dob: m.dob, birthPlace: m.birthPlace.trim() })),
      wish: wish.trim(),
      address: needsAddress ? { name: addr.name.trim(), phone: tenDigits(addr.phone), line1: addr.line1.trim(), line2: addr.line2.trim(), city: addr.city.trim(), state: addr.state.trim(), postalCode: addr.postalCode.trim() } : null,
      requestId,
    });
    setSending(false);
    if (!res.ok) {
      setServerError(res.message);
      // The date filled up or closed meanwhile: show fresh dates.
      if (/date|slot|full|closed/i.test(res.message)) { reloadSlots(); setErrors((e) => ({ ...e, slot: "Please pick the date again" })); }
      return;
    }
    setDone(res.data);
    setRequestId(newRequestId());
    toast(`${R.noun} booking request received`, "success");
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* ---------- helpers ---------- */
  const inputCls = (k: string, extra?: string) => cn(fieldBase, errors[k] ? fieldBad : fieldOk, extra);
  const aria = (k: string) => ({ id: fid(k), "aria-invalid": Boolean(errors[k]) || undefined, "aria-describedby": errors[k] ? `${fid(k)}-err` : undefined });
  const setMember = (i: number, patch: Partial<Member>) => {
    setMembers((m) => m.map((x, k) => (k === i ? { ...x, ...patch } : x)));
    clearErr(...Object.keys(patch).map((f) => `members.${i}.${f}`));
  };
  const months = useMemo(() => {
    const out: { month: string; items: SlotView[] }[] = [];
    for (const s of (slots ?? []).slice(0, slotLimit)) {
      const m = fmtDay(s.date, { month: "long", year: "numeric" });
      const last = out[out.length - 1];
      if (last && last.month === m) last.items.push(s); else out.push({ month: m, items: [s] });
    }
    return out;
  }, [slots, slotLimit]);
  const WA = `https://wa.me/${phoneDigits(store.whatsappNumber)}`;

  /* ---------- success ---------- */
  if (done) {
    return (
      <section id="book" className="scroll-mt-24 overflow-hidden rounded-3xl border border-gold-400/30 bg-white p-6 text-center shadow-[0_24px_60px_-36px_rgba(201,148,42,0.6)] sm:p-8">
        <motion.span initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-lg">
          <CheckCircle2 size={30} />
        </motion.span>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Your {R.lower} request is received</h2>
        <p className="mt-1 text-sm text-muted">Booking ref <span className="font-semibold text-gold-700">{done.bookingNumber}</span></p>
        <div className="mx-auto mt-4 grid max-w-md gap-2 rounded-2xl border border-foreground/8 bg-gold-400/[0.05] p-4 text-left text-sm">
          <Row k="Pooja" v={pooja.title} />
          <Row k="Date" v={`${fmtDay(done.date, { weekday: "long", day: "numeric", month: "long" })}${fmtTime(done.time) ? `, ${fmtTime(done.time)}` : ""}${done.label ? ` · ${done.label}` : ""}`} />
          <Row k="Amount" v={format(done.total)} />
        </div>
        <ol className="mx-auto mt-4 max-w-md space-y-1.5 text-left text-[13px] text-muted">
          <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-emerald-600" /> Our team will call you on {contact.phone} to confirm the details and payment.</li>
          <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-emerald-600" /> The {R.lower} is performed {(pooja.havan.durationDays > 1 && pooja.type === "havan") ? `over ${pooja.havan.durationDays} days from the chosen date` : "on the chosen date"} with your sankalp.</li>
          <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-emerald-600" /> You receive the {R.lower} video{needsAddress ? " and prasad at your address" : ""}.</li>
        </ol>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href={R.base}><Button variant="gold" size="md">Browse More {R.plural}</Button></Link>
          <a href={WA} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="md"><PhoneCall size={15} /> Talk to us</Button></a>
        </div>
      </section>
    );
  }

  /* ---------- form ---------- */
  return (
    <section id="book" aria-labelledby={`${uid}-title`} className="scroll-mt-24">
      <div className="mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-600">Book this {R.lower}</p>
        <h2 id={`${uid}-title`} className="text-xl font-semibold text-foreground">Book {pooja.title}</h2>
        <p className="mt-0.5 text-sm text-muted">No payment now. Our team calls you to confirm the booking.</p>
      </div>

      <form onSubmit={submit} noValidate className="grid gap-4 lg:grid-cols-[1fr_19rem] lg:items-start">
        <div className="space-y-4">
          {/* 1. package */}
          <Step n={1} title="Choose a package" hint={`${pooja.packages.length} option${pooja.packages.length > 1 ? "s" : ""}`}>
            <div role="radiogroup" aria-label="Package" className="grid gap-2.5 sm:grid-cols-2">
              {pooja.packages.map((p) => {
                const on = p.id === pkg.id;
                return (
                  <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => choosePackage(p.id)}
                    className={cn("relative rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60",
                      on ? "border-gold-400 bg-gold-400/[0.08] shadow-[0_12px_26px_-18px_rgba(201,148,42,0.9)]" : "border-foreground/12 hover:border-gold-400/50")}>
                    {p.popular && <span className="absolute -top-2 right-3 rounded-full bg-gradient-to-r from-gold-400 to-gold-500 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white">Most chosen</span>}
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">{p.name}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-[12px] text-muted"><Users size={12} /> Up to {p.members} name{p.members > 1 ? "s" : ""} in sankalp</span>
                        {pooja.type === "havan" && <TierLine pkg={p} />}
                      </span>
                      <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", on ? "border-gold-500 bg-gold-500 text-white" : "border-foreground/20")}>{on && <Check size={12} strokeWidth={3} />}</span>
                    </span>
                    <span className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-foreground">{format(p.price)}</span>
                      {p.mrp && p.mrp > p.price && <span className="text-[12px] text-muted line-through">{format(p.mrp)}</span>}
                    </span>
                    {p.description && <span className="mt-1 line-clamp-2 block text-[12px] text-muted">{p.description}</span>}
                  </button>
                );
              })}
            </div>
          </Step>

          {/* 2. date */}
          <Step n={2} title="Pick a date" hint="All times in IST" error={errors.slot} errorId={`${fid("slot")}-err`}>
            <div id={fid("slot")} tabIndex={-1} className="outline-none">
              {slots === null ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-[4.25rem] animate-pulse rounded-xl bg-foreground/[0.05]" />)}</div>
              ) : slots.length === 0 ? (
                <div className="rounded-xl border border-dashed border-foreground/15 p-4 text-center text-sm text-muted">
                  {slotsError || "No dates are open right now."}{" "}
                  <a href={WA} target="_blank" rel="noopener noreferrer" className="font-semibold text-gold-600 hover:text-gold-500">Ask us for the next date</a>
                  {slotsError && <button type="button" onClick={reloadSlots} className="ml-2 inline-flex items-center gap-1 font-semibold text-gold-600"><RefreshCw size={13} /> Retry</button>}
                </div>
              ) : (
                <div className="space-y-3">
                  {months.map((m) => (
                    <div key={m.month}>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{m.month}</p>
                      <div role="radiogroup" aria-label={m.month} className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                        {m.items.map((s) => {
                          const on = s.key === slotKey;
                          const low = s.left <= 5;
                          return (
                            <button key={s.key} type="button" role="radio" aria-checked={on}
                              aria-label={`${fmtDay(s.date, { weekday: "long", day: "numeric", month: "long" })}${fmtTime(s.time) ? ` ${fmtTime(s.time)}` : ""}${s.label ? `, ${s.label}` : ""}, ${s.left} seats left`}
                              onClick={() => { setSlotKey(s.key); clearErr("slot"); setServerError(""); }}
                              className={cn("relative rounded-xl border px-2 py-2 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60",
                                on ? "border-gold-400 bg-gradient-to-b from-gold-400 to-gold-500 text-white shadow-[0_10px_22px_-12px_rgba(201,148,42,0.9)]" : errors.slot ? "border-rose-300 hover:border-rose-400" : "border-foreground/12 hover:border-gold-400/60")}>
                              <span className={cn("block text-[10.5px] font-medium uppercase", on ? "text-white/85" : "text-muted")}>{fmtDay(s.date, { weekday: "short" })}</span>
                              <span className="block text-[15px] font-bold leading-tight">{fmtDay(s.date, { day: "numeric", month: "short" })}</span>
                              <span className={cn("block truncate text-[10.5px]", on ? "text-white/90" : "text-muted")}>{s.label || fmtTime(s.time) || "Any time"}</span>
                              {(low || s.priceDelta !== 0) && (
                                <span className={cn("mt-0.5 block truncate text-[10px] font-semibold", on ? "text-white" : low ? "text-rose-600" : "text-gold-700")}>
                                  {low ? `${s.left} left` : `${s.priceDelta > 0 ? "+" : "−"}${format(Math.abs(s.priceDelta))}`}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {slots.length > slotLimit && (
                    <button type="button" onClick={() => setSlotLimit((l) => l + SLOT_PAGE)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-gold-600 hover:text-gold-500">
                      <CalendarDays size={14} /> Show more dates
                    </button>
                  )}
                </div>
              )}
            </div>
          </Step>

          {/* 3. sankalp */}
          <Step n={3} title="Names for the sankalp" hint={`${members.length} of ${pkg.members}`} error={errors.members} errorId={`${fid("members")}-err`}>
            {cfg.instructions && <p className="mb-3 rounded-lg bg-gold-400/[0.07] px-3 py-2 text-[12.5px] text-foreground/80">{cfg.instructions}</p>}
            <div id={fid("members")} tabIndex={-1} className="space-y-3 outline-none">
              <AnimatePresence initial={false}>
                {members.map((m, i) => (
                  <motion.div key={i} layout={!reduce} initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                    className="overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.015] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[12px] font-semibold uppercase tracking-wider text-muted">Person {i + 1}</span>
                      {members.length > 1 && (
                        <button type="button" onClick={() => setMembers((x) => x.filter((_, k) => k !== i))} aria-label={`Remove person ${i + 1}`} className="flex items-center gap-1 text-[12px] font-medium text-rose-600 hover:text-rose-700">
                          <Trash2 size={13} /> Remove
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <F id={fid(`members.${i}.name`)} label="Full name" required error={errors[`members.${i}.name`]}>
                        <input {...aria(`members.${i}.name`)} className={inputCls(`members.${i}.name`)} value={m.name} maxLength={80} onChange={(e) => setMember(i, { name: e.target.value })} placeholder="Name as spoken in sankalp" />
                      </F>
                      {cfg.askRelation && (
                        <F id={fid(`members.${i}.relation`)} label="Relation" custom>
                          <SelectField id={fid(`members.${i}.relation`)} value={m.relation} options={RELATIONS} onChange={(v) => setMember(i, { relation: v })} />
                        </F>
                      )}
                      {cfg.requireGotra && (
                        <F id={fid(`members.${i}.gotra`)} label="Gotra" hint={`Leave empty if not known (we use ${cfg.defaultGotra || "Kashyap"})`}>
                          <input {...aria(`members.${i}.gotra`)} className={inputCls(`members.${i}.gotra`)} value={m.gotra} maxLength={40} onChange={(e) => setMember(i, { gotra: e.target.value })} placeholder="e.g. Bharadwaj" />
                        </F>
                      )}
                      <F id={fid(`members.${i}.dob`)} label="Date of birth" required={cfg.requireDob} error={errors[`members.${i}.dob`]}>
                        <input {...aria(`members.${i}.dob`)} type="date" max={new Date().toISOString().slice(0, 10)} className={inputCls(`members.${i}.dob`)} value={m.dob} onChange={(e) => setMember(i, { dob: e.target.value })} />
                      </F>
                      <F id={fid(`members.${i}.birthPlace`)} label="Birth place" required={cfg.requireBirthPlace} error={errors[`members.${i}.birthPlace`]}>
                        <input {...aria(`members.${i}.birthPlace`)} className={inputCls(`members.${i}.birthPlace`)} value={m.birthPlace} maxLength={80} onChange={(e) => setMember(i, { birthPlace: e.target.value })} placeholder="City, State" />
                      </F>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {members.length < pkg.members && (
                <button type="button" onClick={() => setMembers((x) => [...x, { ...blankMember(), relation: cfg.askRelation ? "Spouse" : "" }])}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gold-400/60 py-2.5 text-[13px] font-semibold text-gold-700 transition-colors hover:bg-gold-400/[0.06]">
                  <UserPlus size={15} /> Add another name ({pkg.members - members.length} more allowed)
                </button>
              )}
            </div>

            <div className="mt-3">
              <F id={fid("wish")} label="Your sankalp (wish)" required={cfg.requireWish} error={errors.wish} hint={`${wish.length}/${cfg.wishMaxLength}`}>
                <textarea {...aria("wish")} rows={2} maxLength={cfg.wishMaxLength} className={inputCls("wish", "resize-none")} value={wish}
                  onChange={(e) => { setWish(e.target.value); clearErr("wish"); }} placeholder="e.g. Good health and peace for my family" />
              </F>
            </div>
          </Step>

          {/* 4. add-ons */}
          {pooja.addOns.length > 0 && (
            <Step n={4} title={`Add to your ${R.lower}`} hint="Optional">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {pooja.addOns.map((a) => {
                  const n = qty[a.id] ?? 0;
                  return (
                    <div key={a.id} className={cn("flex items-start gap-3 rounded-xl border p-3 transition-colors", n > 0 ? "border-gold-400 bg-gold-400/[0.06]" : "border-foreground/12")}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{a.name}</p>
                        {a.description && <p className="mt-0.5 line-clamp-2 text-[12px] text-muted">{a.description}</p>}
                        <p className="mt-1 text-[13px] font-bold text-foreground">{a.price === 0 ? "Free" : format(a.price)}</p>
                      </div>
                      {a.maxQty <= 1 ? (
                        <button type="button" role="switch" aria-checked={n > 0} aria-label={`Add ${a.name}`} onClick={() => setQty((q) => ({ ...q, [a.id]: n > 0 ? 0 : 1 }))}
                          className={cn("mt-0.5 flex h-7 items-center rounded-full px-3 text-[12px] font-semibold transition-colors", n > 0 ? "bg-gold-500 text-white" : "border border-gold-400/60 text-gold-700 hover:bg-gold-400/10")}>
                          {n > 0 ? <><Check size={13} className="mr-1" /> Added</> : "Add"}
                        </button>
                      ) : (
                        <div className="mt-0.5 flex items-center rounded-full border border-foreground/12">
                          <button type="button" aria-label={`Less ${a.name}`} disabled={n === 0} onClick={() => setQty((q) => ({ ...q, [a.id]: Math.max(0, n - 1) }))} className="flex h-7 w-7 items-center justify-center text-foreground disabled:opacity-30"><Minus size={13} /></button>
                          <span className="w-6 text-center text-[13px] font-semibold tabular-nums" aria-live="polite">{n}</span>
                          <button type="button" aria-label={`More ${a.name}`} disabled={n >= a.maxQty} onClick={() => setQty((q) => ({ ...q, [a.id]: Math.min(a.maxQty, n + 1) }))} className="flex h-7 w-7 items-center justify-center text-foreground disabled:opacity-30"><Plus size={13} /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Step>
          )}

          {/* 5. contact */}
          <Step n={pooja.addOns.length > 0 ? 5 : 4} title="Your contact details" hint="We call to confirm">
            <div className="grid gap-3 sm:grid-cols-3">
              <F id={fid("contact.name")} label="Full name" required error={errors["contact.name"]}>
                <input {...aria("contact.name")} autoComplete="name" className={inputCls("contact.name")} value={contact.name} maxLength={80} onChange={(e) => { setContact((c) => ({ ...c, name: e.target.value })); clearErr("contact.name"); }} placeholder="Your name" />
              </F>
              <F id={fid("contact.phone")} label="Mobile / WhatsApp" required error={errors["contact.phone"]}>
                <input {...aria("contact.phone")} type="tel" inputMode="tel" autoComplete="tel" className={inputCls("contact.phone")} value={contact.phone} maxLength={16} onChange={(e) => { setContact((c) => ({ ...c, phone: e.target.value })); clearErr("contact.phone"); }} placeholder="98765 43210" />
              </F>
              <F id={fid("contact.email")} label="Email" required error={errors["contact.email"]}>
                <input {...aria("contact.email")} type="email" autoComplete="email" className={inputCls("contact.email")} value={contact.email} maxLength={120} onChange={(e) => { setContact((c) => ({ ...c, email: e.target.value })); clearErr("contact.email"); }} placeholder="you@example.com" />
              </F>
            </div>

            <AnimatePresence initial={false}>
              {needsAddress && (
                <motion.div initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mt-4 border-t border-foreground/8 pt-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">Prasad delivery address</p>
                      <button type="button" onClick={() => { setAddr((a) => ({ ...a, name: contact.name, phone: contact.phone })); clearErr("addr.name", "addr.phone"); }} className="text-[12px] font-semibold text-gold-600 hover:text-gold-500">Use my details</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {([["name", "Receiver name", "name", 80], ["phone", "Receiver mobile", "tel", 16], ["line1", "House no., street", "address-line1", 160], ["line2", "Area, landmark (optional)", "address-line2", 160], ["city", "City", "address-level2", 60], ["state", "State", "address-level1", 60], ["postalCode", "PIN code", "postal-code", 6]] as const).map(([k, label, ac, max]) => (
                        <F key={k} id={fid(`addr.${k}`)} label={label} required={k !== "line2"} error={errors[`addr.${k}`]}>
                          <input {...aria(`addr.${k}`)} autoComplete={ac} inputMode={k === "postalCode" || k === "phone" ? "numeric" : undefined} maxLength={max}
                            className={inputCls(`addr.${k}`)} value={addr[k]} onChange={(e) => { setAddr((a) => ({ ...a, [k]: e.target.value })); clearErr(`addr.${k}`); }} />
                        </F>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Step>
        </div>

        {/* summary */}
        <aside className="lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-2xl border border-gold-400/30 bg-white shadow-[0_24px_56px_-36px_rgba(201,148,42,0.7)]">
            <div className="bg-gradient-to-r from-gold-400/15 via-gold-400/5 to-royal-500/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-700">Booking summary</p>
              <p className="mt-0.5 line-clamp-2 text-[15px] font-semibold text-foreground">{pooja.title}</p>
            </div>
            <div className="space-y-2 px-4 py-3 text-[13px]">
              <Row k={pkg.name} v={format(pkg.price)} />
              <Row k="Date" v={slot ? `${fmtDay(slot.date)}${fmtTime(slot.time) ? `, ${fmtTime(slot.time)}` : ""}` : "Not chosen"} muted={!slot} />
              {slot && slot.priceDelta !== 0 && <Row k={slot.label || "Date price"} v={`${slot.priceDelta > 0 ? "+" : "−"}${format(Math.abs(slot.priceDelta))}`} />}
              {chosenAddOns.map((a) => <Row key={a.id} k={`${a.name}${qty[a.id] > 1 ? ` × ${qty[a.id]}` : ""}`} v={format(a.price * qty[a.id])} />)}
              <Row k="Names in sankalp" v={`${members.length}`} />
              <div className="flex items-baseline justify-between border-t border-foreground/8 pt-2.5">
                <span className="text-sm font-semibold text-foreground">Total</span>
                <motion.span key={pricing.total} initial={reduce ? false : { scale: 1.08, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} className="text-xl font-bold text-foreground">{format(pricing.total)}</motion.span>
              </div>
            </div>
            <div className="space-y-2 border-t border-foreground/8 px-4 py-3.5">
              {serverError && (
                <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-2 text-[12.5px] text-rose-600"><AlertCircle size={14} className="mt-0.5 shrink-0" /> {serverError}</p>
              )}
              <Button type="submit" variant="gold" size="lg" disabled={sending} className="w-full gap-1.5">
                {sending ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : <>Request Booking <ArrowRight size={16} /></>}
              </Button>
              <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-muted"><Lock size={12} className="mt-0.5 shrink-0 text-gold-500" /> No payment now. We call you to confirm. Your details are used only for this pooja.</p>
            </div>
          </div>
        </aside>
      </form>
    </section>
  );
}

function Step({ n, title, hint, error, errorId, children }: { n: number; title: string; hint?: string; error?: string; errorId?: string; children: React.ReactNode }) {
  return (
    <fieldset className={cn("rounded-2xl border bg-white p-4 shadow-[0_14px_36px_-30px_rgba(36,26,59,0.45)] sm:p-5", error ? "border-rose-300" : "border-foreground/10")}>
      <legend className="sr-only">{title}</legend>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-foreground" aria-hidden>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-[12px] font-bold text-white shadow-sm">{n}</span>
          {title}
        </h3>
        {hint && <span className="text-[11.5px] text-muted">{hint}</span>}
      </div>
      {children}
      {error && <p id={errorId} className="mt-2 flex items-center gap-1 text-xs font-medium text-rose-600"><AlertCircle size={12} /> {error}</p>}
    </fieldset>
  );
}

function F({ id, label, required, hint, error, custom, children }: { id: string; label: string; required?: boolean; hint?: string; error?: string; custom?: boolean; children: React.ReactNode }) {
  const head = (<>{label}{required && <span className="text-rose-mystic"> *</span>}</>);
  return (
    <div>
      {custom ? <span id={`${id}-label`} className="mb-1 block text-[13px] font-medium text-foreground">{head}</span>
        : <label htmlFor={id} className="mb-1 block text-[13px] font-medium text-foreground">{head}</label>}
      {children}
      {error ? (
        <p id={`${id}-err`} className="mt-1 flex items-center gap-1 text-xs font-medium text-rose-600"><AlertCircle size={12} className="shrink-0" /> {error}</p>
      ) : hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <p className="flex items-start justify-between gap-3">
      <span className="min-w-0 text-muted">{k}</span>
      <span className={cn("shrink-0 text-right font-medium", muted ? "text-muted" : "text-foreground")}>{v}</span>
    </p>
  );
}
