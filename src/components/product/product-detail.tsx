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
} from "lucide-react";
import type { Product } from "@/types";
import { discountPercent, cn } from "@/lib/utils";
import { useCommerce } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { useToast } from "@/lib/toast";
import { Badge, badgeTone } from "@/components/ui/badge";
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

export function ProductDetail({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [caratGuide, setCaratGuide] = useState(false);
  const [pincode, setPincode] = useState("");
  const [eta, setEta] = useState<string | null>(null);
  const { addToCart, toggleWishlist, isInWishlist, viewProduct } = useCommerce();
  const { format } = useCurrency();
  const { toast } = useToast();
  const wished = isInWishlist(product.id);
  const discount = discountPercent(product.mrp, product.price);

  // record this product in "recently viewed"
  useEffect(() => {
    viewProduct(product);
  }, [product, viewProduct]);

  const handleAdd = () => {
    if (!product.inStock) return;
    addToCart(product, qty);
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
    <div className="mx-auto max-w-7xl px-5 py-10 pb-28 sm:px-8 lg:pb-10">
      {/* breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Shop", href: "/shop" },
          { label: product.name },
        ]}
        className="mb-8"
      />

      <div className="grid gap-12 lg:grid-cols-2">
        {/* gallery */}
        <ProductGallery product={product} />

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

          <h1 className="mt-3 text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
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
            <span className="text-4xl font-semibold text-gradient-gold">
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
          <p className="mt-1 text-xs text-muted">Inclusive of all taxes</p>

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

          {/* trust strip */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {trustItems.map((t) => (
              <div
                key={t.label}
                className="flex flex-col items-center gap-2 rounded-2xl border border-foreground/10 bg-nebula p-4 text-center"
              >
                <t.icon size={20} className="text-gold-600" />
                <span className="text-xs font-medium text-foreground">{t.label}</span>
              </div>
            ))}
          </div>

          {/* spec table */}
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
          <div className="mt-3 overflow-hidden rounded-2xl glass">
            <Spec label="Stone" value={product.attributes.stone} />
            <Spec label="Origin" value={product.attributes.origin} />
            <Spec label="Weight" value={`${product.attributes.weightCarat} carat`} />
            <Spec label="Colour" value={product.attributes.color} />
            <Spec label="Certification" value={product.attributes.certification} last />
          </div>
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

function Spec({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-5 py-3.5 text-sm",
        !last && "border-b border-foreground/8"
      )}
    >
      <span className="text-muted">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
