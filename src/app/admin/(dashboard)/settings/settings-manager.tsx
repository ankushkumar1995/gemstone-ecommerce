"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Store,
  Truck,
  Receipt,
  Globe,
  Save,
  CreditCard,
  ShoppingCart,
  Bell,
  Search,
  Users,
  Palette,
  Plus,
  Trash2,
  Boxes,
  ClipboardList,
  Mail,
} from "lucide-react";
import type { StoreSettings, TeamMember, UpdateSettingsDto } from "@/modules/settings";
import { adminApi } from "@/lib/admin-api";
import {
  PageHeader,
  Card,
  Field,
  AdminInput,
  AdminTextarea,
  AdminButton,
  AdminDropdown,
  Toggle,
  Tabs,
  Badge,
  StatsSkeleton,
  ImagePickerField,
  useAdminToast,
} from "../../_components";

type TabKey =
  | "general"
  | "localization"
  | "payments"
  | "shipping"
  | "tax"
  | "inventory"
  | "order"
  | "checkout"
  | "email"
  | "notifications"
  | "seo"
  | "team"
  | "appearance";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"];
const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
];

const fade = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export function SettingsManager() {
  const { toast } = useAdminToast();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("general");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await adminApi.settings.get();
      if (res.ok) setSettings(res.data);
      setLoading(false);
    })();
  }, []);

  const save = async (section: UpdateSettingsDto) => {
    setSaving(true);
    const res = await adminApi.settings.update(section);
    setSaving(false);
    if (res.ok) {
      setSettings(res.data);
      toast("Settings saved", "success");
    } else toast(res.message, "error");
  };

  if (loading || !settings) {
    return (
      <div>
        <PageHeader title="Settings" subtitle="Configure your store." />
        <StatsSkeleton count={3} />
      </div>
    );
  }

  const tabs: { value: TabKey; label: string }[] = [
    { value: "general", label: "General" },
    { value: "localization", label: "Localization" },
    { value: "payments", label: "Payments" },
    { value: "shipping", label: "Shipping" },
    { value: "tax", label: "Tax" },
    { value: "inventory", label: "Inventory" },
    { value: "order", label: "Orders" },
    { value: "checkout", label: "Checkout" },
    { value: "email", label: "Email" },
    { value: "notifications", label: "Notifications" },
    { value: "seo", label: "SEO & Social" },
    { value: "team", label: "Team" },
    { value: "appearance", label: "Appearance" },
  ];

  return (
    <div>
      <PageHeader title="Settings" subtitle="Store-wide configuration used across checkout, orders and the storefront." />

      <div className="mb-5 overflow-x-auto">
        <Tabs tabs={tabs} value={tab} onChange={(v) => setTab(v)} />
      </div>

      <motion.div key={tab} variants={fade} initial="hidden" animate="show" transition={{ duration: 0.3 }}>
        {tab === "general" && <GeneralTab settings={settings} saving={saving} onSave={save} />}
        {tab === "localization" && <LocalizationTab settings={settings} saving={saving} onSave={save} />}
        {tab === "payments" && <PaymentsTab settings={settings} saving={saving} onSave={save} />}
        {tab === "shipping" && <ShippingTab settings={settings} saving={saving} onSave={save} />}
        {tab === "tax" && <TaxTab settings={settings} saving={saving} onSave={save} />}
        {tab === "inventory" && <InventoryTab settings={settings} saving={saving} onSave={save} />}
        {tab === "order" && <OrderTab settings={settings} saving={saving} onSave={save} />}
        {tab === "checkout" && <CheckoutTab settings={settings} saving={saving} onSave={save} />}
        {tab === "email" && <EmailTab settings={settings} saving={saving} onSave={save} />}
        {tab === "notifications" && <NotificationsTab settings={settings} saving={saving} onSave={save} />}
        {tab === "seo" && <SeoTab settings={settings} saving={saving} onSave={save} />}
        {tab === "team" && <TeamTab settings={settings} saving={saving} onSave={save} />}
        {tab === "appearance" && <AppearanceTab settings={settings} saving={saving} onSave={save} />}
      </motion.div>
    </div>
  );
}

/* ---------------- tab props ---------------- */
type TabProps = {
  settings: StoreSettings;
  saving: boolean;
  onSave: (section: UpdateSettingsDto) => void;
};

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--a-surface-2)", color: "var(--a-gold)" }}>
        <Icon size={16} />
      </span>
      <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>{title}</h2>
    </div>
  );
}

function SaveBar({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
    <div className="mt-5 flex justify-end">
      <AdminButton onClick={onSave} disabled={saving}>
        <Save size={16} /> {saving ? "Saving…" : "Save changes"}
      </AdminButton>
    </div>
  );
}

/* ---------------- General ---------------- */
function GeneralTab({ settings, saving, onSave }: TabProps) {
  const [g, setG] = useState(settings.general);
  const set = (k: keyof typeof g) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setG({ ...g, [k]: e.target.value });

  return (
    <Card className="max-w-3xl">
      <SectionTitle icon={Store} title="Store details" />
      <div className="mt-4 grid gap-4 sm:grid-cols-[8rem_1fr]">
        <Field label="Logo">
          <ImagePickerField value={g.logo ?? ""} onChange={(url) => setG({ ...g, logo: url })} aspect="aspect-square" />
        </Field>
        <div className="space-y-4">
          <Field label="Store name" required>
            <AdminInput value={g.storeName} onChange={set("storeName")} />
          </Field>
          <Field label="Tagline">
            <AdminInput value={g.tagline ?? ""} onChange={set("tagline")} />
          </Field>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Support email">
          <AdminInput type="email" value={g.supportEmail ?? ""} onChange={set("supportEmail")} />
        </Field>
        <Field label="Support phone">
          <AdminInput value={g.supportPhone ?? ""} onChange={set("supportPhone")} />
        </Field>
        <Field label="WhatsApp number" hint="Used by the storefront WhatsApp button">
          <AdminInput value={g.whatsappNumber ?? ""} onChange={set("whatsappNumber")} />
        </Field>
        <Field label="Business address">
          <AdminTextarea rows={2} value={g.address ?? ""} onChange={set("address")} />
        </Field>
        <Field label="Timezone">
          <AdminDropdown
            value={g.timezone}
            options={TIMEZONES.map((t) => ({ value: t, label: t }))}
            onChange={(v) => setG({ ...g, timezone: v })}
            className="w-full"
          />
        </Field>
      </div>
      <SaveBar saving={saving} onSave={() => onSave({ general: g })} />
    </Card>
  );
}

/* ---------------- Shipping ---------------- */
function ShippingTab({ settings, saving, onSave }: TabProps) {
  const [s, setS] = useState(settings.shipping);
  return (
    <Card className="max-w-3xl">
      <SectionTitle icon={Truck} title="Shipping" />
      <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
        These drive the checkout totals customers see.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Free shipping threshold (₹)" hint="Orders at/above this ship free">
          <AdminInput type="number" value={String(s.freeShippingThreshold)} onChange={(e) => setS({ ...s, freeShippingThreshold: Number(e.target.value) })} />
        </Field>
        <Field label="Flat shipping rate (₹)" hint="Charged below the threshold">
          <AdminInput type="number" value={String(s.flatRate)} onChange={(e) => setS({ ...s, flatRate: Number(e.target.value) })} />
        </Field>
        <Field label="Delivery estimate">
          <AdminInput value={s.deliveryEstimate ?? ""} onChange={(e) => setS({ ...s, deliveryEstimate: e.target.value })} placeholder="3–5 business days" />
        </Field>
      </div>
      <SaveBar saving={saving} onSave={() => onSave({ shipping: s })} />
    </Card>
  );
}

/* ---------------- Tax ---------------- */
function TaxTab({ settings, saving, onSave }: TabProps) {
  const [t, setT] = useState(settings.tax);
  return (
    <Card className="max-w-3xl">
      <SectionTitle icon={Receipt} title="Tax" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Default tax / GST rate (%)">
          <AdminInput type="number" value={String(t.rate)} onChange={(e) => setT({ ...t, rate: Number(e.target.value) })} />
        </Field>
        <Field label="GSTIN" hint="Printed on invoices">
          <AdminInput value={t.gstin ?? ""} onChange={(e) => setT({ ...t, gstin: e.target.value })} />
        </Field>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Tax-inclusive pricing</p>
          <p className="text-xs" style={{ color: "var(--a-faint)" }}>Displayed prices already include tax</p>
        </div>
        <Toggle checked={t.inclusive} onChange={(v) => setT({ ...t, inclusive: v })} />
      </div>
      <SaveBar saving={saving} onSave={() => onSave({ tax: t })} />
    </Card>
  );
}

/* ---------------- Localization ---------------- */
function LocalizationTab({ settings, saving, onSave }: TabProps) {
  const [l, setL] = useState(settings.localization);
  const toggleCurrency = (code: string) =>
    setL((prev) => ({
      ...prev,
      enabledCurrencies: prev.enabledCurrencies.includes(code)
        ? prev.enabledCurrencies.filter((c) => c !== code)
        : [...prev.enabledCurrencies, code],
    }));

  return (
    <Card className="max-w-3xl">
      <SectionTitle icon={Globe} title="Localization" />
      <div className="mt-4 space-y-4">
        <Field label="Default currency">
          <AdminDropdown
            value={l.defaultCurrency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            onChange={(v) => setL({ ...l, defaultCurrency: v })}
            className="w-full max-w-xs"
          />
        </Field>
        <Field label="Enabled currencies" hint="Shown in the storefront currency selector">
          <div className="flex flex-wrap gap-1.5">
            {CURRENCIES.map((c) => {
              const on = l.enabledCurrencies.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCurrency(c)}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    borderColor: on ? "var(--a-gold)" : "var(--a-border)",
                    background: on ? "var(--a-gold-soft)" : "transparent",
                    color: on ? "var(--a-gold)" : "var(--a-fg)",
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Number format">
            <AdminDropdown
              value={l.numberFormat}
              options={[
                { value: "en-IN", label: "1,00,000 (India)" },
                { value: "en-US", label: "100,000 (US)" },
                { value: "en-GB", label: "100,000 (UK)" },
              ]}
              onChange={(v) => setL({ ...l, numberFormat: v as typeof l.numberFormat })}
              className="w-full"
            />
          </Field>
          <Field label="Date format">
            <AdminDropdown
              value={l.dateFormat}
              options={[
                { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
                { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
                { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
              ]}
              onChange={(v) => setL({ ...l, dateFormat: v as typeof l.dateFormat })}
              className="w-full"
            />
          </Field>
        </div>
      </div>
      <SaveBar saving={saving} onSave={() => onSave({ localization: l })} />
    </Card>
  );
}

/* ---------------- Payments ---------------- */
function PaymentsTab({ settings, saving, onSave }: TabProps) {
  const [p, setP] = useState(settings.payments);
  const toggleMethod = (k: keyof typeof p.methods) =>
    setP({ ...p, methods: { ...p.methods, [k]: !p.methods[k] } });

  const METHODS: { key: keyof typeof p.methods; label: string; desc: string }[] = [
    { key: "cod", label: "Cash on Delivery", desc: "Pay when the order arrives" },
    { key: "card", label: "Credit / Debit Card", desc: "Via the payment gateway" },
    { key: "upi", label: "UPI", desc: "GPay, PhonePe, Paytm…" },
    { key: "netbanking", label: "Net Banking", desc: "Direct bank transfer" },
  ];

  return (
    <Card className="max-w-3xl">
      <SectionTitle icon={CreditCard} title="Payments" />
      <div className="mt-4 space-y-2">
        {METHODS.map((m) => (
          <div key={m.key} className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>{m.label}</p>
              <p className="text-xs" style={{ color: "var(--a-faint)" }}>{m.desc}</p>
            </div>
            <Toggle checked={p.methods[m.key]} onChange={() => toggleMethod(m.key)} />
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        <Field label="Payment gateway">
          <AdminDropdown
            value={p.gateway}
            options={[
              { value: "none", label: "None (demo / COD only)" },
              { value: "razorpay", label: "Razorpay" },
              { value: "stripe", label: "Stripe" },
            ]}
            onChange={(v) => setP({ ...p, gateway: v as typeof p.gateway })}
            className="w-full max-w-xs"
          />
        </Field>
        {p.gateway === "razorpay" && (
          <Field label="Razorpay Key ID" hint="Demo field — not used for real payments yet">
            <AdminInput value={p.razorpayKeyId ?? ""} onChange={(e) => setP({ ...p, razorpayKeyId: e.target.value })} placeholder="rzp_live_…" />
          </Field>
        )}
        {p.gateway === "stripe" && (
          <Field label="Stripe Publishable Key" hint="Demo field — not used for real payments yet">
            <AdminInput value={p.stripePublishableKey ?? ""} onChange={(e) => setP({ ...p, stripePublishableKey: e.target.value })} placeholder="pk_live_…" />
          </Field>
        )}
      </div>
      <SaveBar saving={saving} onSave={() => onSave({ payments: p })} />
    </Card>
  );
}

/* ---------------- Checkout ---------------- */
function CheckoutTab({ settings, saving, onSave }: TabProps) {
  const [c, setC] = useState(settings.checkout);
  return (
    <Card className="max-w-3xl">
      <SectionTitle icon={ShoppingCart} title="Checkout" />
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Guest checkout</p>
            <p className="text-xs" style={{ color: "var(--a-faint)" }}>Allow ordering without an account</p>
          </div>
          <Toggle checked={c.guestCheckout} onChange={(v) => setC({ ...c, guestCheckout: v })} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Require phone number</p>
            <p className="text-xs" style={{ color: "var(--a-faint)" }}>Make phone mandatory at checkout</p>
          </div>
          <Toggle checked={c.requirePhone} onChange={(v) => setC({ ...c, requirePhone: v })} />
        </div>
      </div>
      <div className="mt-4">
        <Field label="Minimum order value (₹)" hint="0 = no minimum">
          <AdminInput type="number" value={String(c.minOrderValue)} onChange={(e) => setC({ ...c, minOrderValue: Number(e.target.value) })} className="max-w-xs" />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Terms & conditions text">
          <AdminTextarea rows={3} value={c.termsText ?? ""} onChange={(e) => setC({ ...c, termsText: e.target.value })} />
        </Field>
      </div>
      <SaveBar saving={saving} onSave={() => onSave({ checkout: c })} />
    </Card>
  );
}

/* ---------------- Notifications ---------------- */
function NotificationsTab({ settings, saving, onSave }: TabProps) {
  const [n, setN] = useState(settings.notifications);
  return (
    <Card className="max-w-3xl">
      <SectionTitle icon={Bell} title="Notifications & Email" />
      <div className="mt-4 space-y-4">
        <Field label="Admin alert email" hint="New-order alerts go here">
          <AdminInput type="email" value={n.adminAlertEmail ?? ""} onChange={(e) => setN({ ...n, adminAlertEmail: e.target.value })} />
        </Field>
        <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Order confirmation email</p>
            <p className="text-xs" style={{ color: "var(--a-faint)" }}>Send to customers after they order</p>
          </div>
          <Toggle checked={n.sendOrderConfirmation} onChange={(v) => setN({ ...n, sendOrderConfirmation: v })} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Shipping update email</p>
            <p className="text-xs" style={{ color: "var(--a-faint)" }}>Notify when an order ships</p>
          </div>
          <Toggle checked={n.sendShippingUpdate} onChange={(v) => setN({ ...n, sendShippingUpdate: v })} />
        </div>
        <Field label="Order confirmation template" hint="Use {{customer}} and {{orderNumber}} placeholders">
          <AdminTextarea rows={3} value={n.orderConfirmationTemplate ?? ""} onChange={(e) => setN({ ...n, orderConfirmationTemplate: e.target.value })} />
        </Field>
      </div>
      <SaveBar saving={saving} onSave={() => onSave({ notifications: n })} />
    </Card>
  );
}

/* ---------------- SEO & Social ---------------- */
function SeoTab({ settings, saving, onSave }: TabProps) {
  const [s, setS] = useState(settings.seo);
  const set = (k: keyof typeof s) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setS({ ...s, [k]: e.target.value });

  return (
    <Card className="max-w-3xl">
      <SectionTitle icon={Search} title="SEO & Social" />
      <div className="mt-4 space-y-4">
        <Field label="Default meta title" hint={`${(s.metaTitle ?? "").length}/70`}>
          <AdminInput value={s.metaTitle ?? ""} onChange={set("metaTitle")} maxLength={70} />
        </Field>
        <Field label="Default meta description" hint={`${(s.metaDescription ?? "").length}/180`}>
          <AdminTextarea rows={2} value={s.metaDescription ?? ""} onChange={set("metaDescription")} maxLength={180} />
        </Field>
        <Field label="Default OG / social image">
          <ImagePickerField value={s.ogImage ?? ""} onChange={(url) => setS({ ...s, ogImage: url })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instagram URL">
            <AdminInput value={s.instagram ?? ""} onChange={set("instagram")} placeholder="https://instagram.com/…" />
          </Field>
          <Field label="Facebook URL">
            <AdminInput value={s.facebook ?? ""} onChange={set("facebook")} placeholder="https://facebook.com/…" />
          </Field>
          <Field label="YouTube URL">
            <AdminInput value={s.youtube ?? ""} onChange={set("youtube")} placeholder="https://youtube.com/@…" />
          </Field>
          <Field label="Google Analytics ID">
            <AdminInput value={s.googleAnalyticsId ?? ""} onChange={set("googleAnalyticsId")} placeholder="G-XXXXXXX" />
          </Field>
        </div>
      </div>
      <SaveBar saving={saving} onSave={() => onSave({ seo: s })} />
    </Card>
  );
}

/* ---------------- Team / Users ---------------- */
function TeamTab({ settings, saving, onSave }: TabProps) {
  const [members, setMembers] = useState<TeamMember[]>(settings.team.members);

  const update = (i: number, patch: Partial<TeamMember>) =>
    setMembers((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const remove = (i: number) => setMembers((prev) => prev.filter((_, idx) => idx !== i));
  const add = () =>
    setMembers((prev) => [...prev, { id: `tmp_${Date.now()}`, name: "", email: "", role: "staff" }]);

  const roleTone = (r: TeamMember["role"]) => (r === "admin" ? "gold" : r === "manager" ? "royal" : "muted");

  return (
    <Card className="max-w-3xl">
      <div className="flex items-center justify-between">
        <SectionTitle icon={Users} title="Team & roles" />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/[0.04]"
          style={{ borderColor: "var(--a-border)", color: "var(--a-gold)" }}
        >
          <Plus size={12} /> Add member
        </button>
      </div>
      <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
        Demo only — becomes live once real authentication is in place.
      </p>
      <div className="mt-4 space-y-3">
        {members.map((m, i) => (
          <div key={m.id} className="rounded-lg border p-3" style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}>
            <div className="flex items-center justify-between">
              <Badge tone={roleTone(m.role)}>{m.role}</Badge>
              <button
                type="button"
                onClick={() => remove(i)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-500/10"
                aria-label="Remove member"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <AdminInput value={m.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Name" />
              <AdminInput type="email" value={m.email} onChange={(e) => update(i, { email: e.target.value })} placeholder="Email" />
              <AdminDropdown
                value={m.role}
                options={[
                  { value: "admin", label: "Admin" },
                  { value: "manager", label: "Manager" },
                  { value: "staff", label: "Staff" },
                ]}
                onChange={(v) => update(i, { role: v as TeamMember["role"] })}
                className="w-full"
              />
            </div>
          </div>
        ))}
      </div>
      <SaveBar
        saving={saving}
        onSave={() =>
          onSave({
            team: {
              members: members.map((m) => ({
                name: m.name,
                email: m.email,
                role: m.role,
                ...(m.id.startsWith("tmp_") ? {} : { id: m.id }),
              })),
            },
          })
        }
      />
    </Card>
  );
}

/* ---------------- Appearance ---------------- */
function AppearanceTab({ settings, saving, onSave }: TabProps) {
  const [a, setA] = useState(settings.appearance);

  return (
    <Card className="max-w-3xl">
      <SectionTitle icon={Palette} title="Branding & appearance" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Accent colour">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={a.accentColor}
              onChange={(e) => setA({ ...a, accentColor: e.target.value })}
              className="h-10 w-14 cursor-pointer rounded-lg border"
              style={{ borderColor: "var(--a-border)" }}
            />
            <AdminInput value={a.accentColor} onChange={(e) => setA({ ...a, accentColor: e.target.value })} className="flex-1" />
          </div>
        </Field>
        <Field label="Secondary colour">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={a.secondaryColor}
              onChange={(e) => setA({ ...a, secondaryColor: e.target.value })}
              className="h-10 w-14 cursor-pointer rounded-lg border"
              style={{ borderColor: "var(--a-border)" }}
            />
            <AdminInput value={a.secondaryColor} onChange={(e) => setA({ ...a, secondaryColor: e.target.value })} className="flex-1" />
          </div>
        </Field>
        <Field label="Font family">
          <AdminDropdown
            value={a.fontFamily}
            options={["Inter", "Poppins", "Manrope", "DM Sans"].map((f) => ({ value: f, label: f }))}
            onChange={(v) => setA({ ...a, fontFamily: v as typeof a.fontFamily })}
            className="w-full"
          />
        </Field>
        <Field label="Corner radius">
          <AdminDropdown
            value={a.borderRadius}
            options={[
              { value: "sharp", label: "Sharp" },
              { value: "soft", label: "Soft" },
              { value: "round", label: "Round" },
            ]}
            onChange={(v) => setA({ ...a, borderRadius: v as typeof a.borderRadius })}
            className="w-full"
          />
        </Field>
      </div>

      {/* preview */}
      <div className="mt-5 rounded-lg border p-4" style={{ borderColor: "var(--a-border)" }}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--a-faint)" }}>Preview</p>
        <div className="flex items-center gap-3">
          <span className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: a.accentColor }}>
            Primary
          </span>
          <span className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: a.secondaryColor }}>
            Secondary
          </span>
          <span style={{ fontFamily: a.fontFamily, color: "var(--a-fg)" }}>Aa — {a.fontFamily}</span>
        </div>
      </div>
      <SaveBar saving={saving} onSave={() => onSave({ appearance: a })} />
    </Card>
  );
}

/* ---------------- Inventory ---------------- */
function InventoryTab({ settings, saving, onSave }: TabProps) {
  const [inv, setInv] = useState(settings.inventory);
  return (
    <Card className="max-w-3xl">
      <SectionTitle icon={Boxes} title="Inventory" />
      <div className="mt-4 space-y-4">
        <Field label="Low-stock threshold" hint="Items at/below this qty are flagged low">
          <AdminInput
            type="number"
            value={String(inv.lowStockThreshold)}
            onChange={(e) => setInv({ ...inv, lowStockThreshold: Number(e.target.value) })}
            className="max-w-[8rem]"
          />
        </Field>
        <Field label="When out of stock">
          <AdminDropdown
            value={inv.outOfStockBehaviour}
            options={[
              { value: "hide", label: "Hide product from store" },
              { value: "show_sold_out", label: "Show as Sold Out" },
              { value: "allow_backorder", label: "Allow backorder" },
            ]}
            onChange={(v) => setInv({ ...inv, outOfStockBehaviour: v as typeof inv.outOfStockBehaviour })}
            className="w-full"
          />
        </Field>
        <Field label="Stock display to customers">
          <AdminDropdown
            value={inv.stockDisplay}
            options={[
              { value: "exact", label: "Show exact quantity" },
              { value: "in_out", label: "Only In / Out of stock" },
              { value: "hidden", label: "Hide stock info" },
            ]}
            onChange={(v) => setInv({ ...inv, stockDisplay: v as typeof inv.stockDisplay })}
            className="w-full"
          />
        </Field>
        <Field label="Auto-SKU pattern" hint="{CAT} = category code · {SEQ} = running number">
          <AdminInput value={inv.skuPattern} onChange={(e) => setInv({ ...inv, skuPattern: e.target.value })} placeholder="{CAT}-{SEQ}" />
        </Field>
      </div>
      <SaveBar saving={saving} onSave={() => onSave({ inventory: inv })} />
    </Card>
  );
}

/* ---------------- Orders ---------------- */
function OrderTab({ settings, saving, onSave }: TabProps) {
  const [ord, setOrd] = useState(settings.order);
  return (
    <Card className="max-w-3xl">
      <SectionTitle icon={ClipboardList} title="Orders" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Order number prefix" hint="e.g. NK → NK-2026-1234">
          <AdminInput value={ord.numberPrefix} onChange={(e) => setOrd({ ...ord, numberPrefix: e.target.value.toUpperCase() })} className="font-mono uppercase" />
        </Field>
        <Field label="Auto-cancel unpaid after (hours)" hint="0 = never">
          <AdminInput type="number" value={String(ord.autoCancelUnpaidHours)} onChange={(e) => setOrd({ ...ord, autoCancelUnpaidHours: Number(e.target.value) })} />
        </Field>
        <Field label="Min quantity per item">
          <AdminInput type="number" value={String(ord.minQtyPerItem)} onChange={(e) => setOrd({ ...ord, minQtyPerItem: Number(e.target.value) })} />
        </Field>
        <Field label="Max quantity per item" hint="0 = no limit">
          <AdminInput type="number" value={String(ord.maxQtyPerItem)} onChange={(e) => setOrd({ ...ord, maxQtyPerItem: Number(e.target.value) })} />
        </Field>
      </div>
      <SaveBar saving={saving} onSave={() => onSave({ order: ord })} />
    </Card>
  );
}

/* ---------------- Email / SMTP ---------------- */
function EmailTab({ settings, saving, onSave }: TabProps) {
  const [em, setEm] = useState(settings.email);
  const set = (k: keyof typeof em) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEm({ ...em, [k]: e.target.value });

  return (
    <Card className="max-w-3xl">
      <SectionTitle icon={Mail} title="Email & SMTP" />
      <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
        Sender identity and SMTP connection for transactional emails. Demo —
        passwords are never stored in the mock.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="From name">
          <AdminInput value={em.fromName} onChange={set("fromName")} placeholder="Nakshatra" />
        </Field>
        <Field label="From email" required>
          <AdminInput type="email" value={em.fromEmail} onChange={set("fromEmail")} placeholder="orders@nakshatra.com" />
        </Field>
        <Field label="Reply-to">
          <AdminInput type="email" value={em.replyTo ?? ""} onChange={set("replyTo")} placeholder="support@nakshatra.com" />
        </Field>
        <Field label="SMTP host">
          <AdminInput value={em.smtpHost ?? ""} onChange={set("smtpHost")} placeholder="smtp.provider.com" />
        </Field>
        <Field label="SMTP port">
          <AdminInput type="number" value={String(em.smtpPort ?? "")} onChange={(e) => setEm({ ...em, smtpPort: Number(e.target.value) })} placeholder="587" />
        </Field>
        <Field label="SMTP user">
          <AdminInput value={em.smtpUser ?? ""} onChange={set("smtpUser")} placeholder="apikey / username" />
        </Field>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>SMTP configured</p>
          <p className="text-xs" style={{ color: "var(--a-faint)" }}>Mark on once your SMTP credentials are set up</p>
        </div>
        <Toggle checked={em.smtpConfigured} onChange={(v) => setEm({ ...em, smtpConfigured: v })} />
      </div>
      <SaveBar saving={saving} onSave={() => onSave({ email: em })} />
    </Card>
  );
}
