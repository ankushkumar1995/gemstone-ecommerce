"use client";

/**
 * Lightweight, dependency-free SVG charts (LineChart, BarChart, Donut) with
 * framer-motion draw animations. Enough for dashboard analytics without
 * pulling in a heavy charting library.
 */

import { motion } from "framer-motion";

const GOLD = "#c9942a";
const GOLD_LIGHT = "#e6b43a";

/* ---------------- LineChart (area) ---------------- */
export function LineChart({
  data,
  height = 180,
}: {
  data: number[];
  height?: number;
}) {
  const w = 100; // viewBox width (percent-like)
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = w / (data.length - 1 || 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = 100 - ((v - min) / range) * 100;
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = `${line} L${w},100 L0,100 Z`;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height }}>
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD_LIGHT} stopOpacity="0.35" />
          <stop offset="100%" stopColor={GOLD_LIGHT} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill="url(#lineFill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke={GOLD}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

/* ---------------- BarChart ---------------- */
export function BarChart({
  data,
  height = 180,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex w-full flex-1 items-end">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(d.value / max) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="w-full rounded-t-md bg-gradient-to-t from-[#c9942a] to-[#e6b43a]"
            />
          </div>
          <span className="text-[10px]" style={{ color: "var(--a-faint)" }}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Donut ---------------- */
export function Donut({
  segments,
  size = 160,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        {segments.map((seg) => {
          const frac = seg.value / total;
          const dash = frac * circumference;
          const circle = (
            <motion.circle
              key={seg.label}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="12"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            />
          );
          offset += dash;
          return circle;
        })}
      </svg>
      <ul className="space-y-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span style={{ color: "var(--a-muted)" }}>{s.label}</span>
            <span className="font-semibold" style={{ color: "var(--a-fg)" }}>
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
