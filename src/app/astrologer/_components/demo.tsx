"use client";

/** Small shared bits for the demo (mock-data) partner pages. */

import { FlaskConical } from "lucide-react";

export function DemoBanner({ what = "This page" }: { what?: string }) {
  return (
    <div className="mb-5 flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-xs" style={{ borderColor: "var(--a-border-strong, #d4d4d8)", color: "var(--a-muted)" }} role="note">
      <FlaskConical size={14} className="mt-0.5 shrink-0" style={{ color: "var(--a-gold)" }} aria-hidden />
      <span>{what} shows demo data for now. It goes live once the backend for it is connected.</span>
    </div>
  );
}

export const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString("en-IN");
}

export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Mask phone numbers, emails, UPI ids and links (same rule the live chat will apply). */
export function maskContacts(text: string) {
  return text
    .replace(/[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9.-]*/g, "[hidden]")
    .replace(/(?:\+?91[\s-]?)?(?:\d[\s-]?){9}\d/g, "[hidden]")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[hidden]");
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden fill={i <= Math.round(value) ? "#e6b43a" : "#e4e4e7"}>
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}

/** Wall clock helper (keeps impure calls out of component bodies). */
export const nowMs = () => Date.now();

/** sessionStorage key for the demo live session (one at a time). */
export const DEMO_SESSION_KEY = "astro_demo_session";

export const CHANNEL_LABEL = { chat: "Chat", call: "Voice call", video: "Video call" } as const;
