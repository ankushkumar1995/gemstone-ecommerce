"use client";

/**
 * OrderStatusStepper — a horizontal pipeline (pending → delivered) showing the
 * current stage. Terminal states (cancelled/refunded) show a single banner.
 */

import { motion } from "framer-motion";
import { Check, XCircle } from "lucide-react";
import { ORDER_PIPELINE, type OrderStatus } from "@/modules/orders";
import { STATUS_META } from "./order-status";

export function OrderStatusStepper({ status }: { status: OrderStatus }) {
  if (status === "cancelled" || status === "refunded") {
    const meta = STATUS_META[status];
    return (
      <div
        className="flex items-center gap-2 rounded-lg border px-4 py-3"
        style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}
      >
        <XCircle size={18} className={status === "cancelled" ? "text-rose-500" : "text-gray-400"} />
        <span className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>
          This order was {meta.label.toLowerCase()}.
        </span>
      </div>
    );
  }

  const currentIndex = ORDER_PIPELINE.indexOf(status);

  return (
    <div className="flex items-center">
      {ORDER_PIPELINE.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const reached = i <= currentIndex;
        return (
          <div key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <motion.span
                initial={false}
                animate={{ scale: active ? 1.1 : 1 }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  background: reached ? "var(--a-gold)" : "var(--a-surface-2)",
                  color: reached ? "#fff" : "var(--a-faint)",
                  boxShadow: active ? "0 0 0 4px var(--a-gold-soft)" : undefined,
                }}
              >
                {done ? <Check size={15} /> : i + 1}
              </motion.span>
              <span
                className="whitespace-nowrap text-[11px] font-medium"
                style={{ color: reached ? "var(--a-fg)" : "var(--a-faint)" }}
              >
                {STATUS_META[step].label}
              </span>
            </div>
            {i < ORDER_PIPELINE.length - 1 && (
              <div className="mx-2 h-0.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--a-surface-2)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: i < currentIndex ? "100%" : "0%" }}
                  transition={{ duration: 0.4 }}
                  className="h-full"
                  style={{ background: "var(--a-gold)" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
