"use client";

/**
 * Client helper to lazy-load Razorpay's hosted Checkout script and open the
 * payment modal. The script is injected only when the user actually chooses to
 * pay online, so it never affects initial page load.
 */

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number; // paise
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (resp: unknown) => void) => void;
}

type RazorpayCtor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loadPromise: Promise<boolean> | null = null;

/** Load checkout.js once (idempotent). Resolves true when ready. */
export function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      if (window.Razorpay) resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      loadPromise = null; // allow a retry
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return loadPromise;
}

/** Open the Razorpay Checkout modal. Rejects if the script fails to load. */
export async function openRazorpayCheckout(
  options: Omit<RazorpayOptions, "handler" | "modal">,
  callbacks: { onSuccess: (r: RazorpaySuccess) => void; onDismiss?: () => void },
): Promise<void> {
  const ready = await loadRazorpay();
  if (!ready || !window.Razorpay) {
    throw new Error("Could not load the payment window. Check your connection and try again.");
  }
  const rzp = new window.Razorpay({
    ...options,
    handler: (response) => callbacks.onSuccess(response),
    modal: { ondismiss: () => callbacks.onDismiss?.() },
  });
  rzp.open();
}
