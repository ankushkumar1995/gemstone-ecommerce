"use client";

import { motion } from "framer-motion";
import { Gem, LayoutDashboard, ShoppingCart, Inbox, Sparkles } from "lucide-react";

const features = [
  { icon: LayoutDashboard, text: "Real-time store analytics" },
  { icon: ShoppingCart, text: "Manage orders & fulfilment" },
  { icon: Inbox, text: "Capture & convert leads" },
];

const stats = [
  { value: "₹4.8L", label: "Revenue" },
  { value: "128", label: "Orders" },
  { value: "34", label: "Leads" },
];

export function LoginBrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#2a1d5e] via-[#3b1f7d] to-[#1a1340] lg:block">
      {/* ambient glows */}
      <div className="pointer-events-none absolute -left-20 -top-24 h-96 w-96 rounded-full bg-[#e6b43a]/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-[#9169ff]/30 blur-[120px]" />

      {/* floating gem particles */}
      {[
        { top: "12%", left: "70%", size: 22, delay: 0 },
        { top: "68%", left: "18%", size: 30, delay: 0.6 },
        { top: "40%", left: "82%", size: 16, delay: 1.1 },
        { top: "80%", left: "60%", size: 20, delay: 0.3 },
      ].map((g, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute text-white/10"
          style={{ top: g.top, left: g.left }}
          animate={{ y: [0, -14, 0], rotate: [0, 12, 0] }}
          transition={{ duration: 6, repeat: Infinity, delay: g.delay, ease: "easeInOut" }}
        >
          <Gem size={g.size} />
        </motion.div>
      ))}

      {/* subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* content */}
      <div className="relative flex h-full flex-col justify-between p-12 text-white">
        {/* brand */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#e6b43a] to-[#f3d891] text-[#2a1d5e] shadow-lg">
            <Gem size={22} />
          </span>
          <span className="text-xl font-semibold tracking-wide">Nakshatra</span>
        </motion.div>

        {/* headline + features */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-[#f3d891] backdrop-blur-sm">
              <Sparkles size={12} /> Admin Console
            </span>
            <h1 className="mt-5 font-semibold leading-tight tracking-tight text-4xl xl:text-5xl">
              Run your gemstone
              <br />
              empire with ease.
            </h1>
            <p className="mt-4 max-w-md text-white/70">
              One powerful dashboard to manage products, orders, leads and
              everything your astrology store needs.
            </p>
          </motion.div>

          <motion.ul
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } } }}
            className="mt-8 space-y-3"
          >
            {features.map((f) => (
              <motion.li
                key={f.text}
                variants={{
                  hidden: { opacity: 0, x: -16 },
                  show: { opacity: 1, x: 0 },
                }}
                className="flex items-center gap-3 text-sm text-white/90"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                  <f.icon size={17} />
                </span>
                {f.text}
              </motion.li>
            ))}
          </motion.ul>
        </div>

        {/* stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="grid grid-cols-3 gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
        >
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-bold text-[#f3d891]">{s.value}</p>
              <p className="text-xs text-white/60">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
