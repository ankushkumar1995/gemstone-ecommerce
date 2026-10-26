"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import type { ReportResponse } from "@/types/astrology";
import { shopApi } from "@/lib/shop-api";
import { Button } from "@/components/ui/button";
import { CityInput } from "./city-input";

const inputClass =
  "w-full rounded-xl border border-foreground/15 bg-void px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20";

/**
 * Shared birth-details form used by all the chart/sign/gemstone/dosha tools.
 * On submit it fetches the full astrology report and hands it back via
 * `onResult`, so each tool just renders the slice it cares about.
 */
export function BirthForm({
  cta,
  requireTime = false,
  onResult,
}: {
  cta: string;
  requireTime?: boolean;
  onResult: (data: ReportResponse) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    if (!f.date || !f.place) {
      setError("Please enter your date and place of birth.");
      return;
    }
    if (requireTime && !f.time) {
      setError("Please enter your time of birth for an accurate result.");
      return;
    }
    setLoading(true);
    const res = await shopApi.astrology.report({
      name: f.name,
      date: f.date,
      time: f.time || "12:00",
      place: f.place,
    });
    setLoading(false);
    if (res.ok) onResult(res.data);
    else setError(res.message);
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-3xl rounded-[2rem] border border-gold-400/25 bg-nebula p-6 shadow-[0_30px_80px_-30px_rgba(36,26,59,0.45)] sm:p-8"
    >
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-gold-500" />
        <h2 className="text-xl font-semibold text-foreground">Enter Your Birth Details</h2>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Labeled label="Name (optional)">
          <input name="name" className={inputClass} placeholder="Your name" />
        </Labeled>
        <Labeled label="Date of Birth" required>
          <input name="date" type="date" className={inputClass} required />
        </Labeled>
        <Labeled label="Time of Birth" required={requireTime}>
          <input name="time" type="time" className={inputClass} />
        </Labeled>
        <Labeled label="Place of Birth" required>
          <CityInput name="place" placeholder="Start typing your city…" />
        </Labeled>
      </div>
      {error && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{error}</p>}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button type="submit" variant="gold" size="lg" disabled={loading}>
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> Calculating…</>
          ) : (
            <>{cta} <ArrowRight size={16} /></>
          )}
        </Button>
        <span className="text-xs text-muted">100% free · instant result</span>
      </div>
    </motion.form>
  );
}

function Labeled({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}{required && <span className="text-rose-mystic"> *</span>}
      </span>
      {children}
    </label>
  );
}
