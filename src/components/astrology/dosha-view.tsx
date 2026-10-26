"use client";

import Link from "next/link";
import { ShieldAlert, Check, AlertTriangle } from "lucide-react";
import type { DoshaResult } from "@/lib/astrology/doshas";
import { Button } from "@/components/ui/button";
import { AstroToolView, ToolProse, ResultHeading } from "./astro-tool-view";

export function DoshaView() {
  return (
    <AstroToolView
      breadcrumb="Dosha Checker"
      badge="Manglik · Kaal Sarp · Sade Sati"
      badgeIcon={ShieldAlert}
      titleTop="Free Dosha"
      titleAccent="Checker"
      intro="Check your birth chart for the three most-asked doshas — Manglik (Mangal) dosha, Kaal Sarp dosha and Sade Sati. Enter your birth details to see which apply to you and what they mean. Remember: most doshas have well-established remedies."
      cta="Check My Doshas"
      requireTime
      renderResult={(d) => (
        <div className="mx-auto max-w-2xl">
          <ResultHeading icon={ShieldAlert}>Your Dosha Report</ResultHeading>
          <p className="-mt-4 mb-8 text-center text-sm text-muted">
            {d.name}, born in {d.place} · Lagna {d.ascendant.rashi} · Moon {d.moonSign.rashi}
          </p>
          <div className="space-y-4">
            <DoshaCard d={d.doshas.manglik} />
            <DoshaCard d={d.doshas.kaalSarp} />
            <DoshaCard d={d.doshas.sadeSati} />
          </div>
          <div className="mt-8 rounded-[2rem] bg-gradient-to-br from-royal-500 to-royal-700 p-7 text-center text-white">
            <h3 className="font-display text-xl font-semibold">Worried about a dosha?</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/80">
              Don&apos;t panic — most doshas are remediable with the right puja, mantra or gemstone.
              Our astrologers will tell you exactly what to do.
            </p>
            <Link href="/#free-consultation" className="mt-5 inline-block">
              <Button variant="gold" size="lg">Get Free Guidance</Button>
            </Link>
          </div>
        </div>
      )}
    >
      <ToolProse>
        <h2 className="font-display text-2xl font-semibold text-foreground">Understanding doshas</h2>
        <p>
          <strong className="text-foreground">Manglik (Mangal) dosha</strong> forms when Mars sits in
          certain houses from the Ascendant or Moon and is mainly considered during marriage matching.
          <strong className="text-foreground"> Kaal Sarp dosha</strong> occurs when all planets fall
          between Rahu and Ketu. <strong className="text-foreground">Sade Sati</strong> is the ~7.5-year
          transit of Saturn over the 12th, 1st and 2nd signs from your Moon.
        </p>
        <p>
          A dosha is not a curse — it highlights an area of life that needs care and timing. With
          proper remedies, the same energy becomes a source of growth. For a precise analysis of
          severity (and whether cancellation / bhanga applies), consult an astrologer.
        </p>
      </ToolProse>
    </AstroToolView>
  );
}

function DoshaCard({ d }: { d: DoshaResult }) {
  return (
    <div className={`rounded-2xl border p-5 ${d.present ? "border-amber-400/40 bg-amber-400/5" : "border-emerald-400/30 bg-emerald-400/5"}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          {d.present
            ? <AlertTriangle size={16} className="text-amber-600" />
            : <Check size={16} className="text-emerald-600" />}
          {d.title}
        </h3>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${d.present ? "bg-amber-400/15 text-amber-700" : "bg-emerald-400/15 text-emerald-700"}`}>
          {d.verdict}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{d.explanation}</p>
    </div>
  );
}
