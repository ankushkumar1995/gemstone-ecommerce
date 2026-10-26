"use client";

import Link from "next/link";
import { CircleDot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AstroToolView, ToolProse, ResultHeading } from "./astro-tool-view";

export function RudrakshaView() {
  return (
    <AstroToolView
      breadcrumb="Rudraksha Recommendation"
      badge="By Your Chart · Free"
      badgeIcon={CircleDot}
      titleTop="Which Rudraksha"
      titleAccent="Should You Wear?"
      intro="Get a free Rudraksha recommendation based on your birth chart. The right mukhi (face) Rudraksha, chosen for your Ascendant lord, is believed to balance that planet's energy and bring peace, protection and focus."
      cta="Find My Rudraksha"
      renderResult={(d) => (
        <div className="mx-auto max-w-2xl">
          <ResultHeading icon={CircleDot}>Your Rudraksha</ResultHeading>
          <div className="rounded-[2rem] border border-gold-400/25 bg-gradient-to-br from-gold-400/[0.07] to-nebula p-8 text-center">
            <p className="text-sm text-muted">{d.name} · Lagna {d.ascendant.rashi}</p>
            <p className="mt-3 font-display text-5xl font-bold text-gradient-gold">{d.rudraksha.mukhi}</p>
            <p className="mt-2 text-sm text-muted">
              Deity: <span className="font-semibold text-foreground">{d.rudraksha.deity}</span> · Planet:{" "}
              <span className="font-semibold text-gold-600">{d.rudraksha.planet}</span>
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted">{d.rudraksha.benefits}</p>
          </div>
          <div className="mt-5 rounded-2xl border border-foreground/10 bg-nebula p-5 text-center text-sm text-muted">
            <Sparkles size={14} className="mb-1 inline text-gold-500" /> Tip: A genuine Rudraksha
            should be energised before wearing. Our astrologers can guide you.
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/shop?search=rudraksha"><Button variant="gold" size="lg">Shop Rudraksha</Button></Link>
            <Link href="/#free-consultation"><Button variant="outline" size="lg">Ask an Astrologer</Button></Link>
          </div>
        </div>
      )}
    >
      <ToolProse>
        <h2 className="font-display text-2xl font-semibold text-foreground">About Rudraksha</h2>
        <p>
          Rudraksha beads are sacred seeds associated with Lord Shiva, worn for peace, protection and
          spiritual growth. Each bead has a number of faces (mukhi), and different mukhis are linked to
          different planets and deities. The <strong className="text-foreground">5 Mukhi</strong> is the
          most popular and universally wearable, while specific mukhis are recommended based on the
          planet you want to strengthen in your chart.
        </p>
      </ToolProse>
    </AstroToolView>
  );
}
