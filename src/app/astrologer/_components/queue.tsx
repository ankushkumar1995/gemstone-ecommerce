"use client";

/**
 * Waitlist helpers (DEMO). Rules mirrored from the live design:
 *   • strict first-come-first-served (no reordering, no skipping the line)
 *   • join only if the waitlist is open, not full, the customer is not
 *     blocked, not already waiting, and has balance for the minimum minutes
 *   • a customer waiting longer than MAX_WAIT_MIN is removed and notified
 *   • going offline clears the waitlist and notifies everyone in it
 */

import { useEffect } from "react";
import { useAdminToast } from "@/app/admin/_components";
import { usePartner } from "./partner-context";
import { nowMs } from "./demo";
import { blockedStore, queueSettingsStore, queueStore, type QueueEntry } from "./demo-store";
import { MOCK_REQUEST_POOL } from "./mock-data";

export const MAX_WAIT_MIN = 30;
export const AVG_SESSION_MIN = 11;

export type JoinResult = { ok: true; position: number } | { ok: false; reason: string };

export function tryJoin(entry: Omit<QueueEntry, "joinedAt" | "id">, opts: { acceptingQueue: boolean }): JoinResult {
  const settings = queueSettingsStore.get();
  const queue = queueStore.get();
  if (!settings.enabled || !opts.acceptingQueue) return { ok: false, reason: "Waitlist is closed" };
  if (blockedStore.get().some((b) => b.customerId === entry.customerId)) return { ok: false, reason: `${entry.customer} is blocked by you` };
  if (queue.some((q) => q.customerId === entry.customerId)) return { ok: false, reason: `${entry.customer} is already waiting` };
  if (queue.length >= settings.maxSize) return { ok: false, reason: "Waitlist is full. The customer was asked to try later." };
  if (entry.walletMinutes < settings.minMinutes) return { ok: false, reason: `${entry.customer} has balance for under ${settings.minMinutes} min and was asked to recharge first` };
  const row: QueueEntry = { ...entry, id: `q_${nowMs()}_${Math.random().toString(36).slice(2, 6)}`, joinedAt: nowMs() };
  queueStore.set((q) => [...q, row]);
  return { ok: true, position: queue.length + 1 };
}

/** Demo helper: the next customer from the mock pool not already waiting. */
export function nextDemoCustomer(seq: number) {
  const waiting = new Set(queueStore.get().map((q) => q.customerId));
  for (let i = 0; i < MOCK_REQUEST_POOL.length; i++) {
    const r = MOCK_REQUEST_POOL[(seq + i) % MOCK_REQUEST_POOL.length];
    if (!waiting.has(r.customerId)) return r;
  }
  return MOCK_REQUEST_POOL[seq % MOCK_REQUEST_POOL.length];
}

export function removeFromQueue(id: string) {
  queueStore.set((q) => q.filter((x) => x.id !== id));
}

/** Estimated wait for position p (1-based), assuming the current session (if any) is half done. */
export function estimateWait(position: number, liveSession: boolean) {
  return Math.round((position - 1) * AVG_SESSION_MIN + (liveSession ? AVG_SESSION_MIN / 2 : 0));
}

/** Mounted once in the shell: clears the waitlist on going offline and drops over-long waits. */
export function QueueWatcher() {
  const { me } = usePartner();
  const { toast } = useAdminToast();
  const loaded = me !== null;
  const online = me?.presence.online ?? false;

  useEffect(() => {
    if (!loaded || online) return;
    const q = queueStore.get();
    if (q.length) {
      queueStore.set([]);
      toast(`You went offline. ${q.length} waiting customer${q.length > 1 ? "s were" : " was"} notified.`, "info");
    }
  }, [loaded, online, toast]);

  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = nowMs() - MAX_WAIT_MIN * 60000;
      const q = queueStore.get();
      const stale = q.filter((x) => x.joinedAt < cutoff);
      if (!stale.length) return;
      queueStore.set(q.filter((x) => x.joinedAt >= cutoff));
      toast(`${stale[0].customer} waited over ${MAX_WAIT_MIN} min and was removed. They were notified.`, "info");
    }, 15000);
    return () => clearInterval(id);
  }, [toast]);

  return null;
}
