"use client";

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

const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
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
