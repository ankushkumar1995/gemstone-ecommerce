/**
 * Client-side visitor rules for popups — frequency caps, new-vs-returning
 * detection, dismiss cooldown and page/device matching. All browser-only
 * (localStorage + sessionStorage). Pure functions so they're easy to reason
 * about and unit-test.
 *
 * Storage key scheme (localStorage unless noted):
 *   nk_visitor_seen          "1" once the visitor has ever been here (returning)
 *   nk_popup_shown_<id>      ISO timestamp of the last time popup <id> was shown
 *   nk_popup_dismissed_<id>  ISO timestamp of the last dismiss of popup <id>
 *   nk_popup_closed_<id>     "1" when "don't show again" chosen (forever)
 *   nk_popup_session_<id>    (sessionStorage) "1" if shown this browser session
 */

import type { PublicPopup } from "@/modules/popups";

const SEEN_KEY = "nk_visitor_seen";

function ls(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}
function ss(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** Returning = we've seen this browser before. Call markSeen() once per load. */
export function isReturningVisitor(): boolean {
  return ls()?.getItem(SEEN_KEY) === "1";
}

/** Record that this browser has now visited (makes future loads "returning"). */
export function markSeen(): void {
  ls()?.setItem(SEEN_KEY, "1");
}

export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

/** Prefix/wildcard path match. "/shop" matches "/shop" and "/shop/x"; "*" = any. */
function pathMatches(path: string, pattern: string): boolean {
  const p = pattern.trim();
  if (!p) return false;
  if (p === "*" || p === "/*") return true;
  if (p.endsWith("*")) return path.startsWith(p.slice(0, -1));
  return path === p || path.startsWith(p.endsWith("/") ? p : p + "/");
}

export function matchesPage(popup: PublicPopup, path: string): boolean {
  const { pageMode, pagePaths } = popup.targeting;
  if (pageMode === "all") return true;
  // With no paths configured: "include" matches nothing, "exclude" excludes nothing.
  if (pagePaths.length === 0) return pageMode === "exclude";
  const hit = pagePaths.some((pat) => pathMatches(path, pat));
  return pageMode === "include" ? hit : !hit;
}

export function matchesDevice(popup: PublicPopup): boolean {
  const d = popup.targeting.device;
  if (d === "all") return true;
  return d === "mobile" ? isMobile() : !isMobile();
}

export function matchesAudience(popup: PublicPopup): boolean {
  const a = popup.targeting.audience;
  if (a === "all") return true;
  const returning = isReturningVisitor();
  return a === "returning" ? returning : !returning;
}

export function matchesAuth(popup: PublicPopup, loggedIn: boolean | null): boolean {
  const auth = popup.targeting.auth;
  if (auth === "all") return true;
  // If we don't know the auth state yet, don't block — treat as match.
  if (loggedIn === null) return true;
  return auth === "customer" ? loggedIn : !loggedIn;
}

/** True if this popup's frequency / dismiss / "don't show again" rules allow it now. */
export function frequencyAllows(popup: PublicPopup): boolean {
  const id = popup.id;
  const L = ls();
  const S = ss();

  // "Don't show again" forever.
  if (L?.getItem(`nk_popup_closed_${id}`) === "1") return false;

  // Dismiss cooldown.
  const cooldownH = popup.frequencyRule.showAgainAfterDismissHours;
  if (cooldownH > 0) {
    const dismissedAt = L?.getItem(`nk_popup_dismissed_${id}`);
    if (dismissedAt) {
      const elapsed = Date.now() - new Date(dismissedAt).getTime();
      if (elapsed < cooldownH * 3600_000) return false;
    }
  }

  const lastShown = L?.getItem(`nk_popup_shown_${id}`);
  switch (popup.frequencyRule.frequency) {
    case "every-visit":
      return true;
    case "once-per-session":
      return S?.getItem(`nk_popup_session_${id}`) !== "1";
    case "once-ever":
      return !lastShown;
    case "once-per-day": {
      if (!lastShown) return true;
      return Date.now() - new Date(lastShown).getTime() >= 24 * 3600_000;
    }
    case "once-per-n-days": {
      if (!lastShown) return true;
      const days = Math.max(1, popup.frequencyRule.everyNDays);
      return Date.now() - new Date(lastShown).getTime() >= days * 24 * 3600_000;
    }
    default:
      return true;
  }
}

/** Record that the popup was shown (for frequency caps). */
export function markShown(popup: PublicPopup): void {
  const id = popup.id;
  ls()?.setItem(`nk_popup_shown_${id}`, new Date().toISOString());
  ss()?.setItem(`nk_popup_session_${id}`, "1");
}

/** Record a dismiss (for cooldown). */
export function markDismissed(id: string): void {
  ls()?.setItem(`nk_popup_dismissed_${id}`, new Date().toISOString());
}

/** Record a permanent "don't show again". */
export function markClosedForever(id: string): void {
  ls()?.setItem(`nk_popup_closed_${id}`, "1");
}
