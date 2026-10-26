"use client";

import Link from "next/link";
import Image from "next/image";
import { Gem, Hand, Clock, Sparkles, Star } from "lucide-react";
import type { GemInfo } from "@/types/astrology";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { AstroToolView, ToolProse, ResultHeading } from "./astro-tool-view";

export function GemstoneRecoView() {
  return (
    <AstroToolView
      breadcrumb="Gemstone Recommendation"
      badge="Lucky Stone · Free"
      badgeIcon={Gem}
      titleTop="Which Gemstone Should"
      titleAccent="You Wear?"
      intro="Get a free astrological gemstone recommendation based on your birth chart. We analyse your Ascendant (Lagna) and Moon sign to suggest the life stone and lucky stone best suited to you — then help you buy a certified, energised piece."
      cta="Get My Gemstone"
      renderResult={(d) => (
        <div className="mx-auto max-w-5xl">
          <ResultHeading icon={Gem}>Your Gemstone Recommendation</ResultHeading>
          <p className="-mt-4 mb-8 text-center text-sm text-muted">
            {d.name}, born in {d.place} · Lagna {d.ascendant.rashi} · Moon {d.moonSign.rashi}
          </p>
          <div className="grid gap-5 lg:grid-cols-3">
            <GemCard tag="Most Auspicious" gem={d.gemstones.benefic} primary />
            <GemCard tag="Life Stone" gem={d.gemstones.life} />
            <GemCard tag="Lucky Stone" gem={d.gemstones.lucky} />
          </div>
          <p className="mt-6 rounded-2xl border border-foreground/10 bg-void/50 px-5 py-4 text-center text-sm text-muted">
            Powerful stones like Blue Sapphire (Neelam) are best worn after an astrologer&apos;s
            advice. Book a free consultation before wearing a new gemstone.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/#free-consultation"><Button variant="gold" size="lg">Confirm with an Astrologer</Button></Link>
            <Link href="/shop"><Button variant="outline" size="lg">Browse All Gemstones</Button></Link>
          </div>
        </div>
      )}
    >
      <ToolProse>
        <h2 className="font-display text-2xl font-semibold text-foreground">How gemstone recommendation works</h2>
        <p>
          In Vedic astrology, each planet rules a gemstone — Ruby (Manik) for the Sun, Pearl (Moti)
          for the Moon, Yellow Sapphire (Pukhraj) for Jupiter, Blue Sapphire (Neelam) for Saturn and
          so on. Your <strong className="text-foreground">life stone</strong> is linked to the lord
          of your Ascendant (Lagna), while your <strong className="text-foreground">lucky stone</strong>{" "}
          comes from your Moon-sign lord. Wearing the right stone can strengthen a supportive planet
          and bring balance to your chart.
        </p>
        <p>
          Every gemstone at Astrounkle is 100% natural, lab-certified and energised (prana
          pratishtha) before dispatch — so the stone you wear is authentic and ready to work for you.
        </p>
      </ToolProse>
    </AstroToolView>
  );
}

function GemCard({ tag, gem, primary }: { tag: string; gem: GemInfo; primary?: boolean }) {
  const { format } = useCurrency();
  return (
    <div className={`relative flex flex-col overflow-hidden rounded-[2rem] border p-6 ${primary ? "border-gold-400/50 bg-gradient-to-br from-gold-400/[0.12] to-nebula shadow-[0_20px_50px_-30px_rgba(201,148,42,0.5)]" : "border-foreground/10 bg-nebula"}`}>
      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${primary ? "bg-gold-400 text-white" : "bg-gold-400/15 text-gold-600"}`}>
        <Sparkles size={11} /> {tag}
      </span>
      <h3 className="mt-4 font-display text-2xl font-bold text-foreground">{gem.gem}</h3>
      <p className="text-sm font-medium text-gold-600">{gem.hindi}</p>
      <p className="mt-1 text-xs text-muted">{gem.basis}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted">{gem.benefits}</p>
      <div className="mt-4 space-y-2 border-t border-foreground/8 pt-4 text-sm">
        <Row icon={Hand} label="Finger" value={gem.finger} />
        <Row icon={Gem} label="Metal" value={gem.metal} />
        <Row icon={Clock} label="Day" value={gem.day} />
      </div>

      {/* matched product from the live catalogue, if any */}
      <div className="mt-auto pt-5">
        {gem.product ? (
          <Link href={`/product/${gem.product.slug}`} className="group block overflow-hidden rounded-2xl border border-foreground/10 bg-void/40 transition-colors hover:border-gold-400/40">
            <div className="relative aspect-[16/10] overflow-hidden">
              <Image
                src={gem.product.image}
                alt={gem.product.name}
                fill
                sizes="(max-width: 1024px) 100vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-3">
              <p className="line-clamp-1 text-sm font-semibold text-foreground">{gem.product.name}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-bold text-foreground">{format(gem.product.price)}</span>
                <span className="flex items-center gap-0.5 text-xs text-gold-600">
                  <Star size={11} className="fill-gold-500 text-gold-500" /> {gem.product.rating}
                </span>
              </div>
            </div>
            <div className="px-3 pb-3">
              <Button variant={primary ? "gold" : "outline"} size="sm" className="w-full">
                View &amp; Buy
              </Button>
            </div>
          </Link>
        ) : (
          <Link href={`/shop?search=${encodeURIComponent(gem.shopQuery)}`} className="block">
            <Button variant={primary ? "gold" : "outline"} size="md" className="w-full">
              Shop {gem.gem}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Hand; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted"><Icon size={14} className="text-gold-500" /> {label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
