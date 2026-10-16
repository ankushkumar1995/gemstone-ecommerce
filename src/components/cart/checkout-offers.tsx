"use client";

/**
 * Checkout — "Available offers" (Flipkart-style one-tap coupon list).
 *
 * Fetches the PUBLIC coupons for the current cart subtotal and lets the shopper
 * apply one in a tap. Ineligible coupons (min-cart not met, etc.) are shown
 * disabled with the reason. Secret/targeted coupons never appear here — those
 * still work by typing the exact code in the field above.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tag, ChevronDown, Check, BadgePercent, Loader2 } from "lucide-react";
import { shopApi } from "@/lib/shop-api";
import { useCurrency } from "@/lib/currency";
import type { PublicCoupon } from "@/modules/coupons";
import { cn } from "@/lib/utils";

export function CheckoutOffers({
  cartSubtotal,
  appliedCode,
  onApply,
}: {
  cartSubtotal: number;
  appliedCode: string | null;
  onApply: (code: string) => void | Promise<void>;
}) {
  const { format } = useCurrency();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState<PublicCoupon[]>([]);
  const [applyingCode, setApplyingCode] = useState<string | null>(null);

  // Load offers whenever the panel opens or the cart total changes (eligibility
  // depends on the subtotal). Debounced lightly to avoid spamming on edits.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await shopApi.coupons.available(cartSubtotal);
      if (!active) return;
      setOffers(res.ok ? res.data : []);
      setLoading(false);
    }, 150);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [open, cartSubtotal]);

  const label = (c: PublicCoupon) =>
    c.type === "percentage"
      ? `${c.value}% OFF${c.maxDiscount ? ` up to ${format(c.maxDiscount)}` : ""}`
      : `${format(c.value)} OFF`;

  const handleApply = async (code: string) => {
    setApplyingCode(code);
    await onApply(code);
    setApplyingCode(null);
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-dashed border-gold-400/40 bg-gold-400/[0.04] px-3 py-2.5 text-sm font-medium text-gold-600 transition-colors hover:bg-gold-400/[0.08]"
      >
        <span className="flex items-center gap-2">
          <BadgePercent size={15} /> View available offers
        </span>
        <ChevronDown
          size={16}
          className={cn("transition-transform", open && "rotate-180")}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-5 text-sm text-muted">
                  <Loader2 size={15} className="animate-spin" /> Loading offers…
                </div>
              ) : offers.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted">
                  No offers available right now. Have a code? Enter it above.
                </p>
              ) : (
                offers.map((c) => {
                  const applied = appliedCode === c.code;
                  return (
                    <div
                      key={c.code}
                      className={cn(
                        "rounded-xl border p-3 transition-colors",
                        applied
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : c.eligible
                            ? "border-foreground/12 bg-void"
                            : "border-foreground/10 bg-void/60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 rounded-md bg-gold-400/12 px-2 py-0.5 font-mono text-xs font-bold text-gold-600">
                              <Tag size={11} /> {c.code}
                            </span>
                            <span className="text-xs font-semibold text-foreground">{label(c)}</span>
                          </div>
                          {c.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted">{c.description}</p>
                          )}
                          {!c.eligible && c.reason && (
                            <p className="mt-1 text-xs text-amber-600">{c.reason}</p>
                          )}
                          {c.eligible && c.previewDiscount > 0 && !applied && (
                            <p className="mt-1 text-xs text-emerald-600">
                              You save {format(c.previewDiscount)}
                            </p>
                          )}
                        </div>

                        {applied ? (
                          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600">
                            <Check size={14} /> Applied
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={!c.eligible || applyingCode === c.code}
                            onClick={() => handleApply(c.code)}
                            className="shrink-0 rounded-lg border border-gold-400/50 px-3 py-1.5 text-xs font-semibold text-gold-600 transition-colors hover:bg-gold-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {applyingCode === c.code ? "…" : "Apply"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
