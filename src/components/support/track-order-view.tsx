"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Search,
  CheckCircle2,
  Truck,
  Home,
  BadgeCheck,
  Flame,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

const steps = [
  { icon: CheckCircle2, label: "Order Confirmed", date: "12 Oct, 10:24 AM" },
  { icon: BadgeCheck, label: "Lab Certified", date: "12 Oct, 4:10 PM" },
  { icon: Flame, label: "Energised (Prana Pratishtha)", date: "13 Oct, 11:00 AM" },
  { icon: Truck, label: "Shipped", date: "13 Oct, 6:30 PM" },
  { icon: Home, label: "Out for Delivery", date: "Expected 15 Oct" },
];

export function TrackOrderView() {
  const [tracked, setTracked] = useState(false);
  // demo: first 4 steps complete
  const currentStep = 3;

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumb items={[{ label: "Track Order" }]} className="mb-8" />
      <div className="mx-auto max-w-2xl text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-500 text-white">
          <Package size={26} />
        </span>
        <h1 className="mt-5 text-3xl font-semibold text-foreground sm:text-4xl">
          Track Your Order
        </h1>
        <p className="mt-2 text-muted">
          Enter your order ID and email to see your gemstone&apos;s journey.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTracked(true);
          }}
          className="mx-auto mt-8 flex max-w-lg flex-col gap-3 sm:flex-row"
        >
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-foreground/15 bg-nebula px-4 py-3">
            <Search size={18} className="shrink-0 text-gold-500" />
            <input
              required
              placeholder="Order ID (e.g. NK-2024-0481)"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
            />
          </div>
          <Button variant="gold" size="lg" type="submit">
            Track
          </Button>
        </form>
      </div>

      <AnimatePresence>
        {tracked && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto mt-12 max-w-2xl rounded-[2rem] border border-foreground/10 bg-nebula p-6 shadow-[0_20px_50px_-30px_rgba(36,26,59,0.4)] sm:p-8"
          >
            <div className="flex items-center justify-between border-b border-foreground/10 pb-5">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">
                  Order
                </p>
                <p className="font-semibold text-foreground">NK-2024-0481</p>
              </div>
              <span className="rounded-full bg-gold-400/15 px-3 py-1 text-sm font-semibold text-gold-600">
                In Transit
              </span>
            </div>

            {/* timeline */}
            <ol className="mt-6 space-y-6">
              {steps.map((s, i) => {
                const done = i <= currentStep;
                const isLast = i === steps.length - 1;
                return (
                  <li key={s.label} className="relative flex gap-4">
                    {!isLast && (
                      <span
                        className={cn(
                          "absolute left-[18px] top-9 h-[calc(100%-4px)] w-0.5",
                          done ? "bg-gold-400" : "bg-foreground/10"
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        done
                          ? "bg-gradient-to-br from-gold-400 to-gold-500 text-white"
                          : "border border-foreground/15 bg-void text-muted"
                      )}
                    >
                      <s.icon size={17} />
                    </span>
                    <div className="pt-1">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          done ? "text-foreground" : "text-muted"
                        )}
                      >
                        {s.label}
                      </p>
                      <p className="text-xs text-muted">{s.date}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </Container>
  );
}
