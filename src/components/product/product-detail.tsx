"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  ShoppingBag,
  ShieldCheck,
  Truck,
  Minus,
  Plus,
  Sparkles,
  RefreshCw,
  BadgeIndianRupee,
  MapPin,
  Share2,
  Check,
  Ruler,
  Video,
  MessageCircle,
  FileCheck2,
  Globe,
  Gem,
  Palette,
  Scissors,
  Award,
  Download,
} from "lucide-react";
import type { Product } from "@/types";
import { discountPercent, cn } from "@/lib/utils";
import { useCommerce } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { useToast } from "@/lib/toast";
import { useStoreSettings, phoneDigits } from "@/lib/store-settings";
import {
  priceConfig,
  type ResolvedConfigurator,
  type ConfigSelection,
} from "@/modules/configurator";
import { ProductConfigurator } from "@/components/product/product-configurator";
import { Rating } from "@/components/ui/rating";
import { Button } from "@/components/ui/button";
import { getZodiac } from "@/data/zodiac";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductTabs } from "@/components/product/product-tabs";
import { ProductReviews } from "@/components/product/product-reviews";
import { CaratGuideModal } from "@/components/product/carat-guide-modal";
import { Breadcrumb } from "@/components/ui/breadcrumb";

const trustItems = [
  { icon: ShieldCheck, label: "Lab Certified" },
  { icon: Truck, label: "Free Shipping" },
  { icon: RefreshCw, label: "7-Day Returns" },
  { icon: BadgeIndianRupee, label: "Lifetime Buyback" },
];

export function ProductDetail({
  product,
  resolved,
}: {
  product: Product;
  /** Effective configurator for this product (resolved server-side). */
  resolved?: ResolvedConfigurator;
}) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [caratGuide, setCaratGuide] = useState(false);
  const [pincode, setPincode] = useState("");
  const [eta, setEta] = useState<string | null>(null);
  // Customer's configurator selection (pooja / jaap / wear). IDs only.
  const [selection, setSelection] = useState<ConfigSelection>({});
  const { addToCart, toggleWishlist, isInWishlist, viewProduct } = useCommerce();
  const { format } = useCurrency();
  const { toast } = useToast();
  const store = useStoreSettings();
  const wished = isInWishlist(product.id);
  const discount = discountPercent(product.mrp, product.price);

  // Live configurator pricing (preview). The server re-validates on checkout.
  const priced = resolved
    ? priceConfig(product.price, resolved, selection)
    : null;
  const addOnTotal = priced?.ok ? priced.priced!.addOnTotal : 0;
  const effectivePrice =
    priced?.ok && priced.unitPrice !== undefined ? priced.unitPrice : product.price;

  const attr = product.attributes;
  // Per-carat price — only meaningful when a carat weight is known.
  const perCarat =
    attr.weightCarat && attr.weightCarat > 0
      ? Math.round(product.price / attr.weightCarat)
      : null;

  // WhatsApp "real photos / video call" deep link, prefilled with this product.
  const waNumber = phoneDigits(store.whatsappNumber || store.supportPhone || "");
  const waHref = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(
        `Hi, I'd like real photos / a live video call for: ${product.name}`,
      )}`
    : null;

  // Spec cards — each renders only if its value exists (data is the switch).
  const specCards = [
    { icon: Globe, label: "Origin", value: attr.origin },
    { icon: Gem, label: "Weight", value: attr.weightCarat ? `${attr.weightCarat} carat` : "" },
    { icon: Palette, label: "Colour", value: attr.color },
    {
      icon: Scissors,
      label: "Treatment",
      value: (attr as { treatment?: string }).treatment,
    },
    { icon: Scissors, label: "Cut", value: (attr as { cut?: string }).cut },
    { icon: Gem, label: "Clarity", value: (attr as { clarity?: string }).clarity },
    { icon: Award, label: "Certification", value: attr.certification },
  ].filter((s) => s.value && String(s.value).trim());

  // record this product in "recently viewed"
  useEffect(() => {
    viewProduct(product);
  }, [product, viewProduct]);

  // Increment the server-side view counter (fire-and-forget). The static page
  // is built from mock data, so resolve the real DB id by slug first, then POST
  // the view. Guarded with sessionStorage so a single visit counts once even
  // through React re-renders / Strict Mode double-invokes.
  useEffect(() => {
    const key = `viewed:${product.slug}`;
    if (typeof window === "undefined" || sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    (async () => {
      try {
        const res = await fetch(`/api/v1/products/slug/${product.slug}`);
        const body = (await res.json()) as { success?: boolean; data?: { id?: string } };
        const id = body?.data?.id;
        if (id) {
          // Best effort — ignore failures (rate-limit, offline, etc.).
          void fetch(`/api/v1/products/${id}/view`, { method: "POST" });
        }
      } catch {
        /* non-critical analytics ping */
      }
    })();
  }, [product.slug]);

  const handleAdd = () => {
    if (!product.inStock) return;
    // If the configurator priced a selection, block on validation errors
    // (e.g. "select a ring size") and carry the selection + priced snapshot.
    if (resolved?.hasAny && priced && !priced.ok) {
      toast(priced.error ?? "Please complete your selection", "wishlist");
      return;
    }
    const opts =
      resolved?.hasAny && priced?.ok
        ? { selection, priced: priced.priced, unitPrice: priced.unitPrice }
        : undefined;
    addToCart(product, qty, opts);
    toast(`${product.name} added to cart`);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleWishlist = () => {
    toggleWishlist(product);
    toast(wished ? "Removed from wishlist" : "Added to wishlist", "wishlist");
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user cancelled */
    }
  };

  const checkPincode = (e: React.FormEvent) => {
    e.preventDefault();
    if (pincode.trim().length < 6) return;
    const d = new Date();
    d.setDate(d.getDate() + 5);
    setEta(
      d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
    );
  };

  return (
    <div className="mx-auto max-w-[90rem] px-5 py-10 pb-28 sm:px-8 lg:pb-10">
      {/* breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Shop", href: "/shop" },
          { label: product.name },
        ]}
        className="mb-8"
      />

      <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
        {/* gallery — capped width, sticks while the info column scrolls */}
        <div className="lg:sticky lg:top-24">
          <div className="mx-auto w-full max-w-md lg:max-w-none">
            <ProductGallery product={product} />
          </div>
        </div>

        {/* info */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-royal-600">
              <Sparkles size={14} className="text-gold-500" />
              {product.attributes.planet} • {product.attributes.stone}
            </div>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-gold-600"
            >
              {copied ? <Check size={15} /> : <Share2 size={15} />}
              {copied ? "Copied" : "Share"}
            </button>
          </div>

          <h1 className="mt-3 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            {product.name}
          </h1>

          <div className="mt-4">
            <Rating value={product.rating} reviews={product.reviews} size={16} />
          </div>

          <p className="mt-5 text-base leading-relaxed text-muted">
            {product.shortDescription}
          </p>

          {/* price */}
          <div className="mt-6 flex items-end gap-3">
            <span className="text-3xl font-semibold text-gradient-gold">
              {format(product.price)}
            </span>
            {discount > 0 && (
              <>
                <span className="text-lg text-muted line-through">
                  {format(product.mrp)}
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-sm font-semibold text-emerald-600">
                  Save {discount}%
                </span>
              </>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            {perCarat && (
              <>
                <span>~{format(perCarat)} per carat</span>
                <span className="text-foreground/20">•</span>
              </>
            )}
            <span>Inclusive of all taxes</span>
            <span className="text-foreground/20">•</span>
            <span className="font-medium text-emerald-600">
              Free energization included
            </span>
          </p>

          {/* SKU — shown only when set */}
          {product.sku && (
            <p className="mt-2 text-xs text-muted">
              SKU: <span className="font-medium text-foreground">{product.sku}</span>
            </p>
          )}

          {/* benefits */}
          <div className="mt-6 flex flex-wrap gap-2">
            {product.attributes.benefits.map((b) => (
              <span
                key={b}
                className="rounded-full border border-royal-400/30 bg-royal-400/10 px-3 py-1.5 text-sm text-royal-700"
              >
                {b}
              </span>
            ))}
          </div>

          {/* zodiac */}
          <div className="mt-6">
            <p className="mb-2 text-sm text-muted">Recommended for</p>
            <div className="flex flex-wrap gap-2">
              {product.zodiac.map((sign) => {
                const z = getZodiac(sign);
                return (
                  <Link
                    key={sign}
                    href={`/shop?zodiac=${sign}`}
                    className="flex items-center gap-1.5 rounded-full border border-foreground/12 bg-nebula px-3 py-1.5 text-sm text-foreground transition-colors hover:border-gold-400/50"
                  >
                    <span style={{ color: z?.accent }}>{z?.symbol}</span>
                    {z?.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* stock */}
          <div className="mt-6 flex items-center gap-2 text-sm">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                product.inStock ? "bg-emerald-500" : "bg-rose-mystic"
              )}
            />
            {product.inStock ? (
              <span className="text-emerald-600">In stock — ready to energise & ship</span>
            ) : (
              <span className="text-rose-mystic">Currently out of stock</span>
            )}
          </div>

          {/* configurator: pooja / mantra jaap (and wear in Phase C) */}
          {resolved && (
            <ProductConfigurator
              resolved={resolved}
              selection={selection}
              onChange={setSelection}
            />
          )}

          {/* running total when add-ons are selected */}
          {resolved?.hasAny && addOnTotal > 0 && (
            <div className="mt-6 flex items-center justify-between rounded-2xl border border-gold-400/30 bg-gold-400/5 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Total · incl. taxes</p>
                <p className="text-xs text-muted">
                  Base {format(product.price)} + add-ons {format(addOnTotal)}
                </p>
              </div>
              <motion.span
                key={effectivePrice}
                initial={{ scale: 0.9, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-2xl font-semibold text-gradient-gold"
              >
                {format(effectivePrice)}
              </motion.span>
            </div>
          )}

          {/* qty + cart */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1 rounded-full border border-foreground/15 bg-nebula p-1">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/10"
                aria-label="Decrease quantity"
              >
                <Minus size={16} />
              </button>
              <span className="w-8 text-center font-medium text-foreground">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/10"
                aria-label="Increase quantity"
              >
                <Plus size={16} />
              </button>
            </div>

            <Button
              variant="gold"
              size="lg"
              disabled={!product.inStock}
              onClick={handleAdd}
              className={cn(!product.inStock && "cursor-not-allowed opacity-50")}
            >
              <ShoppingBag size={18} />
              {product.inStock ? (added ? "Added to Cart ✓" : "Add to Cart") : "Out of Stock"}
            </Button>

            <button
              aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
              onClick={handleWishlist}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full border border-foreground/15 bg-nebula transition-colors hover:text-rose-mystic",
                wished ? "border-rose-mystic/40 text-rose-mystic" : "text-muted"
              )}
            >
              <Heart size={18} className={cn(wished && "fill-current")} />
            </button>
          </div>

          {/* pincode / delivery */}
          <form onSubmit={checkPincode} className="mt-6 max-w-sm">
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Check delivery
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-foreground/15 bg-nebula px-3 py-2">
              <MapPin size={16} className="shrink-0 text-gold-500" />
              <input
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter pincode"
                inputMode="numeric"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              />
              <button
                type="submit"
                className="shrink-0 text-sm font-semibold text-gold-600 hover:text-gold-500"
              >
                Check
              </button>
            </div>
            {eta && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-600">
                <Truck size={14} /> Delivery by{" "}
                <span className="font-semibold">{eta}</span>
              </p>
            )}
          </form>

          {/* real photos / live video call + consultation */}
          <div className="mt-6 space-y-3">
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3.5 py-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/50 hover:shadow-[0_10px_28px_-16px_rgba(16,185,129,0.6)]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
                  <Video size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-tight text-foreground">
                    Real photos + live video call
                  </p>
                  <p className="text-[11px] text-muted">See the exact stone on WhatsApp</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white transition-transform group-hover:scale-105">
                  Get Now
                </span>
              </a>
            )}

            <Link
              href="/services"
              className="group flex items-center gap-2.5 rounded-xl border border-royal-400/25 bg-royal-400/5 px-3.5 py-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-royal-400/50 hover:shadow-[0_10px_28px_-16px_rgba(122,69,245,0.5)]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-royal-400/15 text-royal-600">
                <MessageCircle size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-tight text-foreground">
                  Gemstone Consultation
                </p>
                <p className="text-[11px] text-muted">
                  Ask our Vedic astrologers if it suits you
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-royal-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-transform group-hover:scale-105">
                Book Now
              </span>
            </Link>
          </div>

          {/* trust strip */}
          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {trustItems.map((t, i) => (
              <motion.div
                key={t.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 * i }}
                whileHover={{ y: -3 }}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-foreground/10 bg-nebula p-3 text-center transition-colors hover:border-gold-400/40"
              >
                <t.icon size={18} className="text-gold-600" />
                <span className="text-[11px] font-medium text-foreground">{t.label}</span>
              </motion.div>
            ))}
          </div>

          {/* spec cards */}
          <div className="mt-8 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
              Specifications
            </h3>
            <button
              onClick={() => setCaratGuide(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-gold-600 transition-colors hover:text-gold-500"
            >
              <Ruler size={15} /> Carat &amp; Size Guide
            </button>
          </div>
          {specCards.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {specCards.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  whileHover={{ y: -2 }}
                  className="rounded-xl border border-foreground/10 bg-nebula p-3 text-center"
                >
                  <s.icon size={15} className="mx-auto text-gold-600" />
                  <p className="mt-1.5 text-[10px] uppercase tracking-wider text-muted">
                    {s.label}
                  </p>
                  <p className="mt-0.5 text-[13px] font-semibold text-foreground">
                    {s.value}
                  </p>
                </motion.div>
              ))}
            </div>
          )}

          {/* certification line — authority + certificate no. + PDF */}
          {product.attributes.certification && (
            <div className="group mt-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-gold-400/25 bg-gold-400/5 px-3.5 py-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-400/50 hover:shadow-[0_10px_28px_-16px_rgba(201,148,42,0.5)]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-400/15 text-gold-600">
                <FileCheck2 size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground">
                  {product.attributes.certification} Certified
                </p>
                <p className="text-[11px] text-muted">
                  Included in price
                  {(product.attributes as { certificateNumber?: string }).certificateNumber
                    ? ` · Certificate no. ${(product.attributes as { certificateNumber?: string }).certificateNumber}`
                    : ""}
                </p>
              </div>
              {product.certificatePdf && (
                <a
                  href={product.certificatePdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-gold-400/40 px-3 py-1.5 text-xs font-semibold text-gold-600 transition-colors hover:bg-gold-400/10"
                >
                  <Download size={13} /> Certificate
                </a>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* tabs + reviews */}
      <ProductTabs product={product} />
      <ProductReviews product={product} />

      {/* carat & size guide modal */}
      <CaratGuideModal open={caratGuide} onClose={() => setCaratGuide(false)} />

      {/* sticky mobile add-to-cart bar */}
      <AnimatePresence>
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-foreground/10 bg-cosmos/95 px-4 py-3 backdrop-blur-xl lg:hidden"
        >
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-medium text-foreground">
              {product.name}
            </p>
            <p className="text-base font-bold text-gold-600">
              {format(product.price)}
            </p>
          </div>
          <Button
            variant="gold"
            size="md"
            disabled={!product.inStock}
            onClick={handleAdd}
          >
            <ShoppingBag size={16} />
            {product.inStock ? "Add" : "Sold out"}
          </Button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}


