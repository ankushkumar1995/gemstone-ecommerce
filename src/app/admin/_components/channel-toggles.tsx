"use client";

/**
 * "Show on" switches for catalog items: Website and Mobile app.
 * Used by the service and pooja editors (later: products, banners).
 * The server enforces the same rule (core/channels), this is only the control.
 */

import { AlertTriangle, Globe, Smartphone } from "lucide-react";
import { normalizeChannels, type Channels } from "@/core/channels";
import { Toggle } from "./form";
import { StatusPill } from "./ui";

export function ChannelToggles({ value, onChange, noun = "item" }: { value: Channels | undefined; onChange: (v: Channels) => void; noun?: string }) {
  const v = normalizeChannels(value);
  const row = (key: keyof Channels, label: string, hint: string, Icon: typeof Globe) => (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon size={16} style={{ color: "var(--a-muted)" }} aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>{label}</p>
          <p className="text-[11px]" style={{ color: "var(--a-muted)" }}>{hint}</p>
        </div>
      </div>
      <Toggle checked={v[key]} onChange={(on) => onChange({ ...v, [key]: on })} ariaLabel={`Show this ${noun} on the ${label.toLowerCase()}`} />
    </div>
  );
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-muted)" }}>Show on</p>
      {row("web", "Website", "Listing, page, search and sitemap", Globe)}
      {row("app", "Mobile app", "Android app (iOS later)", Smartphone)}
      {!v.web && !v.app && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700" role="status">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> Not shown anywhere. Customers cannot find or book this {noun}. Existing bookings are not affected.
        </p>
      )}
    </div>
  );
}

/** Compact badge for admin lists. */
export function ChannelBadge({ value }: { value: Channels | undefined }) {
  const v = normalizeChannels(value);
  if (v.web && v.app) return <StatusPill tone="muted">Web + App</StatusPill>;
  if (v.web) return <StatusPill tone="blue">Web only</StatusPill>;
  if (v.app) return <StatusPill tone="gold">App only</StatusPill>;
  return <StatusPill tone="rose">Not shown</StatusPill>;
}
