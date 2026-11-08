"use client";

import Link from "next/link";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type Variant = "primary" | "gold" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-royal-500 to-royal-700 text-white shadow-[0_8px_30px_-8px_rgba(122,69,245,0.45)] hover:shadow-[0_12px_40px_-6px_rgba(122,69,245,0.6)]",
  gold: "bg-gradient-to-r from-gold-400 to-gold-500 text-white font-semibold shadow-[0_8px_30px_-8px_rgba(201,148,42,0.5)] hover:shadow-[0_12px_40px_-6px_rgba(201,148,42,0.7)]",
  ghost: "bg-foreground/5 text-foreground hover:bg-foreground/10 backdrop-blur-md",
  outline:
    "border border-foreground/20 text-foreground hover:border-gold-400/70 hover:text-gold-500",
};

// Compact, consistent heights: sm 34px · md 40px · lg 44px (still easy to tap).
const sizes: Record<Size, string> = {
  sm: "h-[34px] px-4 text-[13px]",
  md: "h-10 px-5 text-sm",
  lg: "h-11 px-6 text-sm",
};

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide transition-colors duration-300 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-2";

const MotionLink = motion.create(Link);

/**
 * A link that looks and animates exactly like <Button> (same hover lift and
 * tap press), without nesting a <button> inside an <a>.
 */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: { variant?: Variant; size?: Size } & Omit<React.ComponentProps<typeof MotionLink>, "ref">) {
  return (
    <MotionLink
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </MotionLink>
  );
}
export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide transition-colors duration-300 cursor-pointer select-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
