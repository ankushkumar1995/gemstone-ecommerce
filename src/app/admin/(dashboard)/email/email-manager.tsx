"use client";

/**
 * Email admin — one page, three tabs:
 *   • Providers  — enable/disable SMTP & Resend, set priority (fallback order),
 *                  from-identity, and send a test email.
 *   • Templates  — per-event editable subject/HTML/text with placeholder chips
 *                  and a live preview. No template = built-in default is used.
 *   • Logs       — recent send attempts with provider + status.
 */

import { useMemo, useState } from "react";
import { Mail, Send, Save, Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { StoreSettings } from "@/modules/settings";
import type { EmailTemplate, EmailLog, EmailEventKey } from "@/modules/email/email.types";
import { EMAIL_EVENTS } from "@/modules/email/email.catalog";
import { adminApi } from "@/lib/admin-api";
import { useOnMount } from "../../_components";
import {
  PageHeader,
  Card,
  Field,
  AdminInput,
  AdminTextarea,
  AdminButton,
  Toggle,
  Tabs,
  StatsSkeleton,
  StatusPill,
  Badge,
  ConfirmDialog,
  useAdminToast,
} from "../../_components";

type TabKey = "providers" | "templates" | "logs";

export function EmailManager() {
  const { toast } = useAdminToast();
  const [tab, setTab] = useState<TabKey>("providers");
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [s, t, l] = await Promise.all([
      adminApi.settings.get(),
      adminApi.email.listTemplates(),
      adminApi.email.logs(100),
    ]);
    if (s.ok) setSettings(s.data);
    if (t.ok) setTemplates(t.data);
    if (l.ok) setLogs(l.data);
    setLoading(false);
  };
  useOnMount(load);

  if (loading || !settings) {
    return (
      <div>
        <PageHeader title="Email" subtitle="Providers, templates & delivery logs." />
        <StatsSkeleton count={3} />
      </div>
    );
  }

  const tabs: { value: TabKey; label: string }[] = [
    { value: "providers", label: "Providers" },
    { value: "templates", label: "Templates" },
    { value: "logs", label: "Logs" },
  ];

  return (
    <div>
      <PageHeader title="Email" subtitle="Delivery providers (with fallback), editable templates, and send logs." />
      <div className="mb-5 overflow-x-auto">
        <Tabs tabs={tabs} value={tab} onChange={(v) => setTab(v)} />
      </div>

      {tab === "providers" && (
        <ProvidersTab
          settings={settings}
          onSaved={(s) => setSettings(s)}
          toast={toast}
        />
      )}
      {tab === "templates" && (
        <TemplatesTab templates={templates} reload={load} toast={toast} />
      )}
      {tab === "logs" && <LogsTab logs={logs} reload={load} />}
    </div>
  );
}

/* ====================== Providers ====================== */

type Toast = (m: string, t?: "success" | "error" | "info") => void;

function ProvidersTab({
  settings,
  onSaved,
  toast,
}: {
  settings: StoreSettings;
  onSaved: (s: StoreSettings) => void;
  toast: Toast;
}) {
  const [em, setEm] = useState(settings.email);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState(settings.email.fromEmail || "");
  const [testing, setTesting] = useState(false);

  const providers = useMemo(() => em.providers ?? [], [em.providers]);

  const updateProvider = (kind: string, patch: Partial<(typeof providers)[number]>) =>
    setEm((prev) => ({
      ...prev,
      providers: (prev.providers ?? []).map((p) => (p.kind === kind ? { ...p, ...patch } : p)),
    }));

  const move = (kind: string, dir: -1 | 1) => {
    const list = [...(em.providers ?? [])].sort((a, b) => a.priority - b.priority);
    const i = list.findIndex((p) => p.kind === kind);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    // swap priorities
    const pi = list[i].priority;
    list[i] = { ...list[i], priority: list[j].priority };
    list[j] = { ...list[j], priority: pi };
    setEm((prev) => ({ ...prev, providers: list }));
  };

  const save = async () => {
    setSaving(true);
    const res = await adminApi.settings.update({ email: em });
    setSaving(false);
    if (res.ok) {
      onSaved(res.data);
      toast("Email providers saved", "success");
    } else toast(res.message, "error");
  };

  const sendTest = async () => {
    if (!testTo.trim()) {
      toast("Enter a recipient email", "error");
      return;
    }
    setTesting(true);
    const res = await adminApi.email.test(testTo.trim());
    setTesting(false);
    if (res.ok) {
      toast(res.data.detail, res.data.delivered ? "success" : "info");
    } else toast(res.message, "error");
  };

  const ordered = [...providers].sort((a, b) => a.priority - b.priority);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <Card>
          <SectionTitle icon={Mail} title="Sender identity" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="From name">
              <AdminInput value={em.fromName} onChange={(e) => setEm({ ...em, fromName: e.target.value })} placeholder="Astrounkle" />
            </Field>
            <Field label="From email" required>
              <AdminInput type="email" value={em.fromEmail} onChange={(e) => setEm({ ...em, fromEmail: e.target.value })} placeholder="orders@astrounkle.com" />
            </Field>
            <Field label="Reply-to">
              <AdminInput type="email" value={em.replyTo ?? ""} onChange={(e) => setEm({ ...em, replyTo: e.target.value })} placeholder="support@astrounkle.com" />
            </Field>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={Send} title="Delivery providers" />
          <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
            Enabled providers are tried top-to-bottom. If one fails, the next is used (automatic fallback).
            Secrets live in <code>.env</code> (<code>SMTP_PASSWORD</code>, <code>RESEND_API_KEY</code>) — never here.
          </p>
          <div className="mt-4 space-y-3">
            {ordered.map((p, idx) => (
              <div key={p.kind} className="rounded-xl border p-4" style={{ borderColor: "var(--a-border)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge tone="royal">{idx + 1}</Badge>
                    <span className="font-semibold capitalize" style={{ color: "var(--a-fg)" }}>
                      {p.kind === "resend" ? "Resend (API)" : "SMTP"}
                    </span>
                    {p.enabled ? <StatusPill tone="green">Enabled</StatusPill> : <StatusPill tone="gold">Off</StatusPill>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IconBtn label="Move up" onClick={() => move(p.kind, -1)} disabled={idx === 0}>
                      <ArrowUp size={15} />
                    </IconBtn>
                    <IconBtn label="Move down" onClick={() => move(p.kind, 1)} disabled={idx === ordered.length - 1}>
                      <ArrowDown size={15} />
                    </IconBtn>
                    <Toggle checked={p.enabled} onChange={(v) => updateProvider(p.kind, { enabled: v })} />
                  </div>
                </div>

                {p.kind === "smtp" && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Field label="SMTP host">
                      <AdminInput value={p.smtpHost ?? ""} onChange={(e) => updateProvider("smtp", { smtpHost: e.target.value })} placeholder="smtp.provider.com" />
                    </Field>
                    <Field label="Port">
                      <AdminInput type="number" value={String(p.smtpPort ?? "")} onChange={(e) => updateProvider("smtp", { smtpPort: Number(e.target.value) })} placeholder="587" />
                    </Field>
                    <Field label="User">
                      <AdminInput value={p.smtpUser ?? ""} onChange={(e) => updateProvider("smtp", { smtpUser: e.target.value })} placeholder="username / apikey" />
                    </Field>
                  </div>
                )}
                {p.kind === "resend" && (
                  <p className="mt-3 text-xs" style={{ color: "var(--a-faint)" }}>
                    Set <code>RESEND_API_KEY</code> in <code>.env</code>. No other config needed — uses the sender identity above.
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <AdminButton onClick={save} disabled={saving}>
              <Save size={16} /> {saving ? "Saving…" : "Save providers"}
            </AdminButton>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <SectionTitle icon={Send} title="Send a test" />
          <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
            Verifies your enabled providers end-to-end.
          </p>
          <div className="mt-4 space-y-3">
            <Field label="Recipient">
              <AdminInput type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
            </Field>
            <AdminButton className="w-full" onClick={sendTest} disabled={testing}>
              <Send size={15} /> {testing ? "Sending…" : "Send test email"}
            </AdminButton>
            <p className="text-xs" style={{ color: "var(--a-faint)" }}>
              Tip: save providers first, then send the test.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ====================== Templates ====================== */

function TemplatesTab({
  templates,
  reload,
  toast,
}: {
  templates: EmailTemplate[];
  reload: () => Promise<void>;
  toast: Toast;
}) {
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [creatingEvent, setCreatingEvent] = useState<EmailEventKey | null>(null);

  if (editing || creatingEvent) {
    return (
      <TemplateEditor
        template={editing}
        event={creatingEvent}
        onClose={() => {
          setEditing(null);
          setCreatingEvent(null);
        }}
        reload={reload}
        toast={toast}
      />
    );
  }

  return (
    <div className="space-y-3">
      {EMAIL_EVENTS.map((ev) => {
        const tpl = templates.find((t) => t.event === ev.event);
        return (
          <Card key={ev.event}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold" style={{ color: "var(--a-fg)" }}>{ev.label}</p>
                  {tpl ? (
                    tpl.enabled ? <StatusPill tone="green">Custom</StatusPill> : <StatusPill tone="gold">Custom (off)</StatusPill>
                  ) : (
                    <Badge tone="royal">Default</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-sm" style={{ color: "var(--a-muted)" }}>{ev.description}</p>
              </div>
              <div>
                {tpl ? (
                  <AdminButton variant="outline" onClick={() => setEditing(tpl)}>
                    <Pencil size={15} /> Edit
                  </AdminButton>
                ) : (
                  <AdminButton variant="outline" onClick={() => setCreatingEvent(ev.event)}>
                    <Plus size={15} /> Customize
                  </AdminButton>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function TemplateEditor({
  template,
  event,
  onClose,
  reload,
  toast,
}: {
  template: EmailTemplate | null;
  event: EmailEventKey | null;
  onClose: () => void;
  reload: () => Promise<void>;
  toast: Toast;
}) {
  const ev = (template?.event ?? event)!;
  const meta = EMAIL_EVENTS.find((e) => e.event === ev);
  const [name, setName] = useState(template?.name ?? meta?.label ?? "Template");
  const [enabled, setEnabled] = useState(template?.enabled ?? true);
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [html, setHtml] = useState(template?.html ?? "");
  const [text, setText] = useState(template?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(false);

  const insert = (token: string) => setHtml((h) => `${h}{{${token}}}`);

  const preview = useMemo(() => {
    const vars: Record<string, string> = {};
    (meta?.placeholders ?? []).forEach((p) => (vars[p] = `[${p}]`));
    return html.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_m, k: string) => vars[k] ?? "");
  }, [html, meta]);

  const save = async () => {
    if (!subject.trim() || !html.trim()) {
      toast("Subject and body are required", "error");
      return;
    }
    setSaving(true);
    const dto = { event: ev, name, enabled, subject, html, text };
    const res = template
      ? await adminApi.email.updateTemplate(template.id, dto)
      : await adminApi.email.createTemplate(dto);
    setSaving(false);
    if (res.ok) {
      toast(template ? "Template saved" : "Template created", "success");
      await reload();
      onClose();
    } else toast(res.message, "error");
  };

  const remove = async () => {
    if (!template) return;
    const res = await adminApi.email.removeTemplate(template.id);
    if (res.ok) {
      toast("Template removed — default will be used", "success");
      await reload();
      onClose();
    } else toast(res.message, "error");
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: "var(--a-fg)" }}>{meta?.label ?? "Template"}</h2>
          <p className="text-sm" style={{ color: "var(--a-muted)" }}>{meta?.description}</p>
        </div>
        <div className="flex gap-2">
          <AdminButton variant="outline" onClick={onClose}>Back</AdminButton>
          {template && (
            <AdminButton variant="outline" onClick={() => setToDelete(true)}>
              <Trash2 size={15} /> Reset to default
            </AdminButton>
          )}
          <AdminButton onClick={save} disabled={saving}>
            <Save size={16} /> {saving ? "Saving…" : "Save"}
          </AdminButton>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Use this custom template</p>
                <p className="text-xs" style={{ color: "var(--a-faint)" }}>Off = fall back to the built-in default</p>
              </div>
              <Toggle checked={enabled} onChange={setEnabled} />
            </div>
            <div className="mt-4 space-y-4">
              <Field label="Template name">
                <AdminInput value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Subject" required hint="Placeholders work here too">
                <AdminInput value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Order confirmed — {{orderNumber}}" />
              </Field>
              <Field label="HTML body" required>
                <AdminTextarea rows={12} value={html} onChange={(e) => setHtml(e.target.value)} className="font-mono text-xs" placeholder="<p>Hi {{customerName}},</p>" />
              </Field>
              <Field label="Plain-text body" hint="Optional — auto-derived from HTML when blank">
                <AdminTextarea rows={4} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionTitle icon={Mail} title="Preview" />
            <div className="mt-3 rounded-lg border p-4" style={{ borderColor: "var(--a-border)", background: "#fff" }}>
              <div dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--a-faint)" }}>
              Placeholders show as <code>[name]</code> here; real values fill in when sent.
            </p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionTitle icon={Plus} title="Placeholders" />
            <p className="mt-1 text-xs" style={{ color: "var(--a-muted)" }}>Click to insert into the HTML body.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(meta?.placeholders ?? []).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => insert(p)}
                  className="rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-black/[0.04]"
                  style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
                >
                  {`{{${p}}}`}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={toDelete}
        onClose={() => setToDelete(false)}
        onConfirm={remove}
        title="Reset to default?"
        message="This removes your custom template. The built-in default will be used for this event."
        confirmLabel="Reset"
        danger
      />
    </div>
  );
}

/* ====================== Logs ====================== */

function LogsTab({ logs, reload }: { logs: EmailLog[]; reload: () => Promise<void> }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle icon={Mail} title="Recent emails" />
        <AdminButton variant="outline" onClick={() => void reload()}>Refresh</AdminButton>
      </div>
      {logs.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: "var(--a-muted)" }}>No emails sent yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--a-faint)" }} className="text-left text-xs uppercase tracking-wider">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Event</th>
                <th className="py-2 pr-3">To</th>
                <th className="py-2 pr-3">Subject</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Via</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t" style={{ borderColor: "var(--a-border)" }}>
                  <td className="py-2 pr-3 whitespace-nowrap" style={{ color: "var(--a-muted)" }}>
                    {new Date(l.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="py-2 pr-3"><Badge tone="royal">{l.event}</Badge></td>
                  <td className="py-2 pr-3" style={{ color: "var(--a-fg)" }}>{l.to}</td>
                  <td className="py-2 pr-3 max-w-[18rem] truncate" style={{ color: "var(--a-fg)" }} title={l.subject}>{l.subject}</td>
                  <td className="py-2 pr-3">
                    {l.status === "delivered" ? <StatusPill tone="green">Delivered</StatusPill>
                      : l.status === "failed" ? <StatusPill tone="rose">Failed</StatusPill>
                        : <StatusPill tone="gold">Logged</StatusPill>}
                  </td>
                  <td className="py-2" style={{ color: "var(--a-muted)" }}>{l.provider ?? (l.error ? l.error : "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ====================== shared ====================== */

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

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04] disabled:opacity-40"
      style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}
    >
      {children}
    </button>
  );
}
