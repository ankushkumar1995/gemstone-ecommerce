"use client";

/**
 * Checkout — Delivery Address step (Flipkart/Amazon-style).
 *
 *  • Shows the customer's SAVED addresses as selectable cards (default picked
 *    first) so returning buyers deliver in one tap — no retyping.
 *  • "Add a new address" reveals an inline editor; on save it's persisted to
 *    the account (DB) and auto-selected for this order.
 *  • With no saved addresses, the editor is shown straight away.
 *
 * IMPORTANT: this renders INSIDE the checkout <form>, so it must NOT use a
 * nested <form> (illegal HTML → breaks hydration and submits the outer form,
 * causing a page refresh). We use controlled inputs + a type="button" save.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Plus, Check, Loader2, Home, Pencil } from "lucide-react";
import { useCommerce, type Address } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const input =
  "w-full rounded-xl border border-foreground/15 bg-void px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20";

const emptyForm = {
  label: "Home",
  name: "",
  phone: "",
  pincode: "",
  line: "",
  city: "",
  state: "",
};

export function CheckoutAddressStep({
  selectedId,
  onSelect,
  onContinue,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onContinue: () => void;
}) {
  const { addresses, addAddressAsync, user } = useCommerce();
  // Open the editor automatically when there are no saved addresses.
  const [adding, setAdding] = useState(addresses.length === 0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    ...emptyForm,
    name: user?.name ?? "",
    phone: user?.phone ?? "",
  });
  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const openEditor = () => {
    setFormError("");
    setForm({ ...emptyForm, name: user?.name ?? "", phone: user?.phone ?? "" });
    setAdding(true);
  };

  const handleSave = async () => {
    if (saving) return;
    // Minimal required-field validation (we're not inside a <form> anymore).
    const missing: string[] = [];
    if (!form.name.trim()) missing.push("name");
    if (!form.phone.trim()) missing.push("phone");
    if (!form.pincode.trim()) missing.push("PIN code");
    if (!form.line.trim()) missing.push("address");
    if (!form.city.trim()) missing.push("city");
    if (!form.state.trim()) missing.push("state");
    if (missing.length) {
      setFormError(`Please fill: ${missing.join(", ")}.`);
      return;
    }

    setFormError("");
    setSaving(true);
    const draft: Omit<Address, "id"> = {
      label: form.label.trim() || "Home",
      name: form.name.trim(),
      phone: form.phone.trim(),
      line: form.line.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      isDefault: addresses.length === 0,
    };
    const res = await addAddressAsync(draft);
    setSaving(false);

    if (!res.ok) {
      setFormError(res.message || "Couldn't save the address. Please try again.");
      return; // keep the editor open so nothing is lost
    }

    // Auto-select the newly added address.
    const list = res.addresses;
    const added =
      [...list].reverse().find(
        (a) => a.line === draft.line && a.pincode === draft.pincode,
      ) ?? list[list.length - 1];
    if (added) onSelect(added.id);
    setAdding(false);
  };

  return (
    <div className="space-y-4">
      {/* saved address cards */}
      {addresses.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => {
            const active = a.id === selectedId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onSelect(a.id)}
                className={cn(
                  "relative rounded-2xl border p-4 text-left transition-all duration-200",
                  active
                    ? "border-gold-500 bg-gold-400/[0.06] shadow-[0_6px_20px_-10px_rgba(201,148,42,0.45)]"
                    : "border-foreground/12 bg-void hover:border-gold-400/50",
                )}
              >
                <span className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg",
                        active ? "bg-gold-400/15 text-gold-600" : "bg-foreground/5 text-muted",
                      )}
                    >
                      <Home size={14} />
                    </span>
                    <span className="text-sm font-semibold text-foreground">{a.label}</span>
                    {a.isDefault && (
                      <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-medium text-muted">
                        Default
                      </span>
                    )}
                  </span>
                  {active && <Check size={16} className="text-gold-600" />}
                </span>
                <p className="mt-2 text-sm font-medium text-foreground">{a.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {a.line}, {a.city}, {a.state} — {a.pincode}
                  {a.phone ? <><br />Phone: {a.phone}</> : null}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* add new address trigger */}
      {!adding && (
        <button
          type="button"
          onClick={openEditor}
          className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-foreground/20 bg-void px-4 py-3 text-sm font-medium text-gold-600 transition-colors hover:border-gold-400/60"
        >
          <Plus size={16} /> Add a new address
        </button>
      )}

      {/* inline editor (NOT a <form> — see file header) */}
      <AnimatePresence initial={false}>
        {adding && (
          <motion.div
            key="addr-editor"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="grid gap-4 overflow-hidden rounded-2xl border border-foreground/12 bg-void p-5 sm:grid-cols-2"
          >
            <input
              placeholder="Label (Home / Office)"
              className={input}
              value={form.label}
              onChange={set("label")}
            />
            <input placeholder="Full name" className={input} value={form.name} onChange={set("name")} />
            <input placeholder="Phone" className={input} value={form.phone} onChange={set("phone")} />
            <input placeholder="PIN code" className={input} value={form.pincode} onChange={set("pincode")} />
            <input
              placeholder="Address (house no, street, area)"
              className={`${input} sm:col-span-2`}
              value={form.line}
              onChange={set("line")}
            />
            <input placeholder="City" className={input} value={form.city} onChange={set("city")} />
            <input placeholder="State" className={input} value={form.state} onChange={set("state")} />
            {formError && <p className="text-xs text-rose-600 sm:col-span-2">{formError}</p>}
            <div className="flex gap-3 sm:col-span-2">
              <Button variant="gold" size="md" type="button" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Saving…
                  </>
                ) : (
                  "Save & Use This Address"
                )}
              </Button>
              {addresses.length > 0 && (
                <Button
                  variant="ghost"
                  size="md"
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setFormError("");
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* continue */}
      {!adding && (
        <div className="pt-1">
          <Button
            variant="gold"
            size="lg"
            type="button"
            onClick={onContinue}
            disabled={!selectedId}
            className="w-full sm:w-auto"
          >
            Deliver to this address
          </Button>
          {!selectedId && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
              <MapPin size={13} /> Select an address to continue
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Compact read-only address summary shown once the step is completed. */
export function AddressSummary({
  address,
  onChange,
}: {
  address: Address;
  onChange: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">
          {address.name}{" "}
          <span className="ml-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-medium text-muted">
            {address.label}
          </span>
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          {address.line}, {address.city}, {address.state} — {address.pincode}
          {address.phone ? ` · ${address.phone}` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="flex shrink-0 items-center gap-1 text-xs font-semibold text-gold-600 hover:text-gold-500"
      >
        <Pencil size={12} /> Change
      </button>
    </div>
  );
}
