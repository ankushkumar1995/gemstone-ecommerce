"use client";

/**
 * Tiny persisted stores for the DEMO partner features (queue, break, blocked
 * customers, summaries, follow-ups, appeals). Backed by session/local storage
 * and shared across pages/tabs through useSyncExternalStore, so the server
 * snapshot is always the initial value (no hydration mismatch).
 *
 * When a feature goes live, replace its store with the API call.
 */

import { useSyncExternalStore } from "react";
import type { TaxProfile } from "./legal";

export interface DemoStore<T> {
  get: () => T;
  set: (next: T | ((cur: T) => T)) => void;
  subscribe: (l: () => void) => () => void;
  initial: T;
}

/** Read a store and re-render when it changes. */
export function useStore<T>(s: DemoStore<T>): T {
  return useSyncExternalStore(s.subscribe, s.get, () => s.initial);
}

export function createStore<T>(key: string, initial: T, kind: "session" | "local" = "local"): DemoStore<T> {
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: T } | null = null;
  const storage = () => (typeof window === "undefined" ? null : kind === "session" ? window.sessionStorage : window.localStorage);

  const get = (): T => {
    const s = storage();
    if (!s) return initial;
    const raw = s.getItem(key);
    if (cache && cache.raw === raw) return cache.value;
    let value = initial;
    try { value = raw === null ? initial : (JSON.parse(raw) as T); } catch { value = initial; }
    cache = { raw, value };
    return value;
  };

  const set = (next: T | ((cur: T) => T)) => {
    const value = typeof next === "function" ? (next as (c: T) => T)(get()) : next;
    const s = storage();
    if (!s) return;
    try { s.setItem(key, JSON.stringify(value)); } catch { /* quota: ignore in demo */ }
    listeners.forEach((l) => l());
  };

  const subscribe = (l: () => void) => {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => { if (e.key === key) l(); };
    window.addEventListener("storage", onStorage);
    return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
  };

  return { get, set, subscribe, initial };
}

/* ------------------------------------------------------------------ *
 * Stores
 * ------------------------------------------------------------------ */

export type Channel = "chat" | "call" | "video";

export interface QueueEntry {
  id: string;
  customer: string;
  customerId: string;
  channel: Channel;
  rate: number;
  question: string;
  walletMinutes: number;
  joinedAt: number;
  birth: { dob: string; time: string; place: string };
}
export interface QueueSettings { enabled: boolean; maxSize: number; autoOffer: boolean; minMinutes: number }
export const queueStore = createStore<QueueEntry[]>("astro_demo_queue", [], "session");
export const queueSettingsStore = createStore<QueueSettings>("astro_demo_queue_settings", { enabled: true, maxSize: 10, autoOffer: true, minMinutes: 5 });

export interface BreakState { until: number | null; startedAt: number | null; day: string; usedMin: number; count: number; keepQueue: boolean }
export const BREAK_DAILY_MIN = 90;
export const BREAK_DAILY_COUNT = 6;
export const breakStore = createStore<BreakState>("astro_demo_break", { until: null, startedAt: null, day: "", usedMin: 0, count: 0, keepQueue: true });

export interface BlockedCustomer { customerId: string; name: string; reason: string; at: string; sessionId?: string }
export const blockedStore = createStore<BlockedCustomer[]>("astro_demo_blocked", []);

export interface ReportEntry { id: string; sessionId: string; customer: string; reason: string; details: string; at: string; status: "submitted" | "under_review" | "action_taken" | "closed"; ended: boolean; blocked: boolean }
export const reportsStore = createStore<ReportEntry[]>("astro_demo_reports", []);

export type RemedyKind = "mantra" | "daan" | "fast" | "puja" | "gemstone" | "lifestyle" | "other";
export interface Remedy { kind: RemedyKind; detail: string; days: number }
export interface SessionSummary { sessionId: string; customer: string; points: string[]; remedies: Remedy[]; productIds: string[]; followUp: string; sentAt: string }
export const summariesStore = createStore<Record<string, SessionSummary>>("astro_demo_summaries", {});

export interface FollowUp { id: string; sessionId: string; customer: string; question: string; askedAt: number; replyBy: number; reply?: string; repliedAt?: number; status: "pending" | "replied" | "expired" | "flagged" }
export const followUpsStore = createStore<FollowUp[] | null>("astro_demo_followups", null);
export const followUpSettingsStore = createStore<{ offer: boolean; windowHours: 24 | 48 | 72 }>("astro_demo_followup_settings", { offer: true, windowHours: 48 });

export interface Appeal { strikeId: string; text: string; at: string; status: "pending" | "accepted" | "rejected"; decision?: string }
export const appealsStore = createStore<Appeal[]>("astro_demo_appeals", []);

/** Today's local date key (YYYY-MM-DD) for daily limits. */
export const todayKey = () => new Date().toLocaleDateString("en-CA");

/* Followers: online alerts are rate limited so followers are not spammed. */
export const FOLLOWER_ALERT_COOLDOWN_MS = 3 * 3600_000;
export const ANNOUNCE_COOLDOWN_MS = 24 * 3600_000;
export interface FollowerSettings { autoNotify: boolean; lastNotifiedAt: number | null; lastAnnouncedAt: number | null; announcements: { text: string; at: string; status: "in_review" | "sent" }[] }
export const followerSettingsStore = createStore<FollowerSettings>("astro_demo_followers", { autoNotify: true, lastNotifiedAt: null, lastAnnouncedAt: null, announcements: [] });

/* Live: one live at a time; persisted for the tab so a reload resumes it. */
export interface LiveState {
  id: string;
  title: string;
  tags: string[];
  startedAt: number;
  allowCalls: boolean;
  callRate: number;
  slowMode: boolean;
  followersOnly: boolean;
  paused: boolean;
}
export const liveStore = createStore<LiveState | null>("astro_demo_live", null, "session");
export const LIVE_MAX_MIN = 180;

/* Tips received in this browser during the demo (on top of mock history). */
export interface TipEntry { id: string; customer: string; amount: number; sessionId: string; note: string; at: string }
export const tipsStore = createStore<TipEntry[]>("astro_demo_tips", []);

/* ---------------- Agreement e-sign ---------------- */
export interface AgreementAcceptance { version: string; acceptedAt: string; name: string; method: "typed_name_otp"; ipMasked: string; device: string; fingerprint: string }
export const agreementStore = createStore<AgreementAcceptance[]>("astro_demo_agreement", []);

/* ---------------- Tax profile ---------------- */
export const taxProfileStore = createStore<TaxProfile>("astro_demo_tax", {
  gstRegistered: false, gstin: "", gstLegalName: "", stateCode: "08", address: "", resident: true,
  panAadhaarLinked: true, itrFiled: true, lowerCertNo: "", lowerCertRate: "", savedAt: null,
});
export const taxHistoryStore = createStore<{ at: string; summary: string }[]>("astro_demo_tax_history", []);

/* ---------------- Two-step login + devices ---------------- */
export interface TwoStep { method: "off" | "sms" | "app"; enabledAt: string | null; backupCodes: string[]; usedCodes: string[] }
export const twoStepStore = createStore<TwoStep>("astro_demo_2fa", { method: "off", enabledAt: null, backupCodes: [], usedCodes: [] });
export const signedOutDevicesStore = createStore<string[]>("astro_demo_signed_out_devices", []);

/* ---------------- Privacy (DPDP) ---------------- */
export interface Deletion { requestedAt: string; scheduledFor: string; reason: string }
export const deletionStore = createStore<Deletion | null>("astro_demo_deletion", null);
export const consentStore = createStore<{ marketing: boolean; research: boolean; whatsapp: boolean; updatedAt: string | null }>("astro_demo_consent", { marketing: true, research: false, whatsapp: true, updatedAt: null });
export const exportsStore = createStore<{ id: string; at: string; kind: "quick" | "full"; status: "ready" | "preparing" }[]>("astro_demo_exports", []);

/* ---------------- Referral ---------------- */
export interface Referral { id: string; name: string; contact: string; invitedAt: string; stage: "invited" | "applied" | "kyc" | "approved" | "qualifying" | "paid" | "expired" | "rejected"; sessions: number; note?: string }
export const referralsStore = createStore<Referral[] | null>("astro_demo_referrals", null);
