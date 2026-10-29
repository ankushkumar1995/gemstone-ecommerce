/**
 * Popups domain — types.
 *
 * Admin-managed popups / modals rendered on the storefront. Each popup is a
 * self-contained "campaign" with its own content, design, targeting rules,
 * trigger, frequency cap, schedule window and analytics counters. The
 * storefront fetches the live set, the client picks the single highest-
 * priority eligible one per the rules, and fires analytics back.
 */

/** What the popup is for — drives which content fields / form it renders. */
export type PopupType =
  | "promo" // image / offer with CTA(s)
  | "newsletter" // email capture
  | "lead" // consultation / lead form (name, phone, email, message)
  | "announcement" // simple text + optional CTA
  | "html"; // custom (sanitised) HTML

/** Where on screen the popup sits. */
export type PopupLayout =
  | "center" // classic centered modal
  | "corner" // slide-in card in a corner
  | "top-bar" // full-width bar at the top
  | "bottom-bar" // full-width bar at the bottom
  | "fullscreen"; // takeover

export type PopupCorner = "bottom-right" | "bottom-left" | "top-right" | "top-left";

/** When the popup appears. */
export type PopupTriggerType = "delay" | "scroll" | "exit-intent" | "load";

/** How often a single visitor sees it. */
export type PopupFrequency =
  | "once-ever"
  | "once-per-session"
  | "once-per-day"
  | "once-per-n-days"
  | "every-visit";

/** Which devices it may show on. */
export type PopupDevice = "all" | "desktop" | "mobile";

/** Which visitors it targets. */
export type PopupAudience = "all" | "new" | "returning";

/** Logged-in state targeting. */
export type PopupAuth = "all" | "guest" | "customer";

/** How page targeting is interpreted. */
export type PopupPageMode = "all" | "include" | "exclude";

/** A single call-to-action button. */
export interface PopupCta {
  label: string;
  href: string;
  style: "primary" | "secondary" | "ghost";
}

export interface PopupContent {
  heading?: string;
  body?: string; // plain text / light markup for non-html types
  image?: string;
  html?: string; // custom HTML (only for type "html"); sanitised on render
  couponCode?: string; // optional coupon to display/copy
  // form-specific
  emailPlaceholder?: string; // newsletter / lead
  submitLabel?: string; // newsletter / lead
  successMessage?: string; // shown after submit
  ctas: PopupCta[]; // 0..2 buttons
}

export interface PopupDesign {
  layout: PopupLayout;
  corner: PopupCorner; // used when layout === "corner"
  width: "sm" | "md" | "lg";
  radius: "none" | "soft" | "round";
  /** When true, the popup is JUST the image (no text/content area). The whole
   *  image is clickable if a first CTA link is set. */
  imageOnly: boolean;
  accentColor?: string; // CTA / highlight color (falls back to store accent)
  backgroundColor?: string;
  textColor?: string;
  overlay: boolean; // dim the page behind (center/fullscreen)
  showClose: boolean;
  closeOnOverlayClick: boolean;
  closeOnEsc: boolean;
}

export interface PopupTargeting {
  pageMode: PopupPageMode;
  pagePaths: string[]; // URL path patterns (prefix match, "*" wildcard)
  device: PopupDevice;
  audience: PopupAudience;
  auth: PopupAuth;
}

export interface PopupTrigger {
  type: PopupTriggerType;
  delaySeconds: number; // for "delay"
  scrollPercent: number; // for "scroll" (0..100)
}

export interface PopupFrequencyRule {
  frequency: PopupFrequency;
  everyNDays: number; // for "once-per-n-days"
  showAgainAfterDismissHours: number; // cooldown after a dismiss (0 = respect frequency only)
}

export interface PopupAnalytics {
  impressions: number;
  clicks: number; // CTA clicks
  dismissals: number;
  submissions: number; // newsletter/lead submits
}

export interface Popup {
  id: string;
  name: string; // admin-facing label
  type: PopupType;
  enabled: boolean;
  priority: number; // higher wins when several are eligible at once
  content: PopupContent;
  design: PopupDesign;
  targeting: PopupTargeting;
  trigger: PopupTrigger;
  frequencyRule: PopupFrequencyRule;
  startAt?: string; // ISO — campaign window start (blank = always)
  endAt?: string; // ISO — campaign window end (blank = never)
  analytics: PopupAnalytics;
  createdAt: string;
  updatedAt: string;
}

/** The slimmed, public-safe shape the storefront receives (no analytics). */
export interface PublicPopup {
  id: string;
  type: PopupType;
  priority: number;
  content: PopupContent;
  design: PopupDesign;
  targeting: PopupTargeting;
  trigger: PopupTrigger;
  frequencyRule: PopupFrequencyRule;
}

/** The analytics event kinds the public endpoint accepts. */
export type PopupEvent = "impression" | "click" | "dismiss" | "submission";
