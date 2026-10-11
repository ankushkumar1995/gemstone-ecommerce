"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, BadgeCheck, X } from "lucide-react";
import type { Product } from "@/types";
import { getReviews, getRatingBreakdown } from "@/data/reviews";
import { useCommerce, type UserReview } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { Rating } from "@/components/ui/rating";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ProductReviews({ product }: { product: Product }) {
  const baseReviews = getReviews(product);
  const breakdown = getRatingBreakdown(product);
  const totalForBars = breakdown.reduce((a, b) => a + b, 0) || 1;

  const { reviewsFor, user } = useCommerce();
  const userReviews = reviewsFor(product.id);
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-10 border-t border-foreground/10 pt-12">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-foreground">
          Customer Reviews
        </h2>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[18rem_1fr]">
        {/* summary */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-3xl border border-foreground/10 bg-nebula p-6 text-center">
            <p className="text-5xl font-bold text-foreground">
              {product.rating.toFixed(1)}
            </p>
            <div className="mt-2 flex justify-center">
              <Rating value={product.rating} size={18} />
            </div>
            <p className="mt-1 text-sm text-muted">
              Based on {product.reviews} reviews
            </p>

            <div className="mt-5 space-y-2">
              {breakdown.map((count, i) => {
                const stars = 5 - i;
                const pct = (count / totalForBars) * 100;
                return (
                  <div key={stars} className="flex items-center gap-2 text-xs">
                    <span className="flex w-8 items-center gap-0.5 text-muted">
                      {stars}
                      <Star size={11} className="fill-gold-400 text-gold-400" />
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/10">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-500"
                      />
                    </div>
                    <span className="w-8 text-right text-muted">{count}</span>
                  </div>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="md"
              className="mt-6 w-full"
              onClick={() => setOpen(true)}
            >
              Write a Review
            </Button>
          </div>
        </div>

        {/* review list */}
        <div className="space-y-5">
          {/* user-written reviews first */}
          {userReviews.map((r) => (
            <ReviewCard key={r.id} review={r} mine />
          ))}

          {baseReviews.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <ReviewCard
                review={{
                  id: r.id,
                  productId: product.id,
                  rating: r.rating,
                  title: r.title,
                  body: r.body,
                  author: r.name,
                  date: new Date().toISOString(),
                }}
                verified={r.verified}
                relativeDate={r.date}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* write-review modal */}
      <ReviewModal
        open={open}
        onClose={() => setOpen(false)}
        product={product}
        defaultName={user?.name}
      />
    </section>
  );
}

function ReviewCard({
  review,
  verified,
  relativeDate,
  mine,
}: {
  review: UserReview;
  verified?: boolean;
  relativeDate?: string;
  mine?: boolean;
}) {
  const initials = review.author
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className={cn(
        "rounded-3xl border bg-nebula p-6",
        mine ? "border-gold-400/40" : "border-foreground/10"
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-royal-500/20 to-gold-400/25 text-sm font-bold text-royal-700">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">{review.author}</p>
            {mine && (
              <span className="rounded-full bg-gold-400/15 px-2 py-0.5 text-[10px] font-semibold text-gold-600">
                You
              </span>
            )}
            {verified && (
              <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                <BadgeCheck size={13} /> Verified
              </span>
            )}
          </div>
          <p className="text-xs text-muted">
            {relativeDate ?? shortDate(review.date)}
          </p>
        </div>
        <div className="flex">
          {Array.from({ length: 5 }).map((_, s) => (
            <Star
              key={s}
              size={14}
              className={cn(
                s < review.rating
                  ? "fill-gold-400 text-gold-400"
                  : "text-foreground/20"
              )}
            />
          ))}
        </div>
      </div>
      <h3 className="mt-4 font-semibold text-foreground">{review.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{review.body}</p>
    </div>
  );
}

function ReviewModal({
  open,
  onClose,
  product,
  defaultName,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
  defaultName?: string;
}) {
  const { addReview } = useCommerce();
  const { toast } = useToast();
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = Object.fromEntries(
      new FormData(e.currentTarget).entries()
    ) as Record<string, string>;
    addReview({
      id: `ur-${Date.now()}`,
      productId: product.id,
      rating,
      title: d.title || "My review",
      body: d.body || "",
      author: d.name || defaultName || "Guest",
      date: new Date().toISOString(),
    });
    toast("Thanks for your review!", "success");
    onClose();
    setRating(5);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="fixed left-1/2 top-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-foreground/10 bg-cosmos p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  Write a Review
                </h3>
                <p className="mt-1 text-sm text-muted">{product.name}</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* star picker */}
              <div>
                <span className="mb-1.5 block text-sm font-medium text-foreground">
                  Your Rating
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const val = i + 1;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRating(val)}
                        onMouseEnter={() => setHover(val)}
                        onMouseLeave={() => setHover(0)}
                        aria-label={`${val} star`}
                        className="p-0.5"
                      >
                        <Star
                          size={28}
                          className={cn(
                            "transition-colors",
                            (hover || rating) >= val
                              ? "fill-gold-400 text-gold-400"
                              : "text-foreground/20"
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">
                  Your Name
                </span>
                <input
                  name="name"
                  defaultValue={defaultName}
                  required
                  placeholder="Your name"
                  className={input}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">
                  Title
                </span>
                <input
                  name="title"
                  required
                  placeholder="Sum up your experience"
                  className={input}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">
                  Review
                </span>
                <textarea
                  name="body"
                  required
                  rows={4}
                  placeholder="What did you like about this gemstone?"
                  className={cn(input, "resize-none")}
                />
              </label>

              <Button variant="gold" size="lg" type="submit" className="w-full">
                Submit Review
              </Button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const input =
  "w-full rounded-xl border border-foreground/15 bg-nebula px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20";
