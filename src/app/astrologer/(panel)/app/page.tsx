"use client";

/**
 * Partner app & alerts. Install the panel as an app, allow alerts, send a test
 * alert, and phone settings that stop alerts from being silenced.
 */

import { BatteryWarning, BellRing, CheckCircle2, Download, Share, Smartphone, Volume2, XCircle } from "lucide-react";
import { AdminButton, Badge, Card, PageHeader, StatsSkeleton, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { usePwa } from "../../_components/pwa";

export default function PartnerAppPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const { canPrompt, installed, ios, push, swReady, install, enablePush, testAlert } = usePwa();
  if (loading || !me) return <StatsSkeleton count={2} />;

  const pushLabel = { unsupported: "Not supported in this browser", default: "Not allowed yet", granted: "Allowed", denied: "Blocked" }[push];

  return (
    <div className="space-y-6">
      <PageHeader title="App & alerts" subtitle="Never miss a request, even when you are on your phone" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Smartphone size={16} /> Install the Partner app</p>
          {installed ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={16} /> Installed. You are using the app.</p>
          ) : ios ? (
            <ol className="list-decimal space-y-1.5 pl-5 text-sm" style={{ color: "var(--a-fg)" }}>
              <li>Open this page in Safari.</li>
              <li>Tap <Share size={13} className="inline" /> Share at the bottom.</li>
              <li>Choose <b>Add to Home Screen</b>, then Add.</li>
              <li>Open Astrounkle Partner from your home screen and allow alerts.</li>
            </ol>
          ) : canPrompt ? (
            <>
              <p className="text-sm" style={{ color: "var(--a-muted)" }}>Adds an icon to your phone or computer. Opens straight into your panel, full screen.</p>
              <AdminButton onClick={async () => { const ok = await install(); toast(ok ? "Installed" : "Install cancelled", ok ? "success" : "info"); }}><Download size={15} /> Install app</AdminButton>
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--a-muted)" }}>Open this page in Chrome on Android, or Chrome/Edge on a computer, and use “Install app” from the browser menu.</p>
          )}
        </Card>

        <Card className="space-y-4 p-5">
          <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><BellRing size={16} /> Request alerts</p>
          <div className="flex items-center gap-2 text-sm">
            {push === "granted" ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className={push === "denied" ? "text-rose-600" : ""} style={push === "denied" ? undefined : { color: "var(--a-muted)" }} />}
            <span style={{ color: "var(--a-fg)" }}>Alerts: {pushLabel}</span>
            <Badge tone={swReady ? "green" : "muted"}>{swReady ? "Alert service ready" : "Alert service starting"}</Badge>
          </div>
          {push === "default" && <AdminButton onClick={async () => { const p = await enablePush(); toast(p === "granted" ? "Alerts allowed" : "Alerts not allowed", p === "granted" ? "success" : "error"); }}>Allow alerts</AdminButton>}
          {push === "denied" && <p className="text-sm" style={{ color: "var(--a-muted)" }}>Alerts are blocked. Open the lock icon next to the address bar, set Notifications to Allow, then reload.</p>}
          {push === "granted" && <AdminButton variant="outline" disabled={!swReady} onClick={async () => { const ok = await testAlert(); toast(ok ? "Test alert sent. Check your notifications." : "Could not send a test alert", ok ? "success" : "error"); }}>Send a test alert</AdminButton>}
          <p className="text-xs" style={{ color: "var(--a-faint)" }}>Today alerts work while the panel or app is open in the background. Alerts with the panel fully closed start when the consultation backend goes live.</p>
        </Card>
      </div>

      <Card className="p-5">
        <p className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Phone settings that stop missed requests</p>
        <ul className="grid gap-3 md:grid-cols-3 text-sm">
          <li className="rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}><BatteryWarning size={16} style={{ color: "var(--a-gold)" }} /><p className="mt-1 font-medium" style={{ color: "var(--a-fg)" }}>Battery saver off</p><p style={{ color: "var(--a-muted)" }}>Settings → Apps → Chrome (or the Partner app) → Battery → Unrestricted.</p></li>
          <li className="rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}><Volume2 size={16} style={{ color: "var(--a-gold)" }} /><p className="mt-1 font-medium" style={{ color: "var(--a-fg)" }}>Sound on</p><p style={{ color: "var(--a-muted)" }}>Keep the ringer on and allow sound for Chrome notifications. Do Not Disturb silences requests.</p></li>
          <li className="rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}><BellRing size={16} style={{ color: "var(--a-gold)" }} /><p className="mt-1 font-medium" style={{ color: "var(--a-fg)" }}>One device</p><p style={{ color: "var(--a-muted)" }}>Stay online from one device at a time so a request rings where you actually are.</p></li>
        </ul>
      </Card>
    </div>
  );
}
