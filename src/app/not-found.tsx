import Link from "next/link";
import { Gem, Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-5 py-20">
      {/* soft glow backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(230,180,58,0.18), transparent 70%)",
        }}
      />

      <div className="relative text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-gold-400 to-royal-600 text-white shadow-lg">
          <Gem size={34} />
        </span>

        <p className="mt-8 text-7xl font-bold leading-none text-gradient-gold sm:text-8xl">
          404
        </p>
        <h1 className="mt-4 text-2xl font-semibold text-foreground sm:text-3xl">
          This gem seems to be lost in the stars
        </h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          The page you&apos;re looking for doesn&apos;t exist or has moved. Let&apos;s
          guide you back.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/">
            <Button variant="gold" size="lg">
              <Home size={16} /> Back to Home
            </Button>
          </Link>
          <Link href="/shop">
            <Button variant="outline" size="lg">
              <Search size={16} /> Browse Gemstones
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
