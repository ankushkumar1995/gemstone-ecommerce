"use client";

/**
 * OrderCelebration — a premium one-shot confetti + glow burst shown on the
 * "Order Placed!" screen. Built entirely with framer-motion (no extra deps),
 * tuned to the brand palette (gold / royal / aura / emerald).
 *
 * Behaviour:
 *   • Fires once on mount (a successful order), then the pieces fall + fade.
 *   • Pointer-events-none + fixed overlay so it never blocks the buttons.
 *   • Respects prefers-reduced-motion: users who opt out of motion get a calm,
 *     static screen (no confetti), which is the accessible thing to do.
 */

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

const COLORS = [
  "#c9942a", // gold-500
  "#e6b43a", // gold-400
  "#9169ff", // aura / violet
  "#6d4bd8", // royal
  "#2fbf71", // emerald
  "#f4d58d", // soft gold
  "#ffffff",
];

interface Piece {
  id: number;
  left: number; // vw start (0-100)
  delay: number;
  duration: number;
  rotate: number;
  drift: number; // horizontal drift in px
  size: number;
  color: string;
  round: boolean;
}

function buildPieces(count: number): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < count; i++) {
    pieces.push({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.35,
      duration: 2.4 + Math.random() * 1.6,
      rotate: (Math.random() - 0.5) * 720,
      drift: (Math.random() - 0.5) * 240,
      size: 7 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      round: Math.random() > 0.55,
    });
  }
  return pieces;
}

export function OrderCelebration() {
  const reduce = useReducedMotion();
  // 90 pieces reads as a rich burst without hurting performance.
  const pieces = useMemo(() => buildPieces(reduce ? 0 : 90), [reduce]);

  if (reduce) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    >
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: "-12vh", x: 0, opacity: 0, rotate: 0 }}
          animate={{
            y: "112vh",
            x: p.drift,
            opacity: [0, 1, 1, 0.9, 0],
            rotate: p.rotate,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: [0.2, 0.6, 0.4, 1],
            opacity: { duration: p.duration, times: [0, 0.08, 0.6, 0.85, 1] },
          }}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}vw`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.5,
            backgroundColor: p.color,
            borderRadius: p.round ? "9999px" : "2px",
            boxShadow: `0 0 6px ${p.color}66`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * SuccessBadge — the animated ✓ medallion: a spring pop, an expanding glow
 * ring, and a few sparkle accents. Drop-in replacement for the static badge.
 */
export function SuccessBadge({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white">
        {children}
      </span>
    );
  }

  return (
    <div className="relative flex items-center justify-center">
      {/* expanding glow ring */}
      <motion.span
        initial={{ scale: 0.4, opacity: 0.6 }}
        animate={{ scale: 2.4, opacity: 0 }}
        transition={{ duration: 1.1, ease: "easeOut", delay: 0.1 }}
        className="absolute h-20 w-20 rounded-full bg-gold-400/50"
      />
      <motion.span
        initial={{ scale: 0.6, opacity: 0.4 }}
        animate={{ scale: 1.9, opacity: 0 }}
        transition={{ duration: 1.3, ease: "easeOut", delay: 0.25 }}
        className="absolute h-20 w-20 rounded-full ring-2 ring-gold-400/40"
      />

      {/* sparkles */}
      {[
        { top: -6, left: -8, d: 0.35, s: 7 },
        { top: -2, right: -10, d: 0.5, s: 5 },
        { bottom: -4, left: 2, d: 0.6, s: 6 },
      ].map((sp, i) => (
        <motion.span
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 0.9, delay: 0.3 + sp.d, ease: "easeOut" }}
          className="absolute rounded-full bg-white"
          style={{
            width: sp.s,
            height: sp.s,
            top: sp.top,
            left: (sp as { left?: number }).left,
            right: (sp as { right?: number }).right,
            bottom: (sp as { bottom?: number }).bottom,
            boxShadow: "0 0 8px #ffffffaa",
          }}
        />
      ))}

      {/* the medallion */}
      <motion.span
        initial={{ scale: 0, rotate: -40 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 14, delay: 0.05 }}
        className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-[0_12px_30px_-8px_rgba(201,148,42,0.6)]"
      >
        {children}
      </motion.span>
    </div>
  );
}
