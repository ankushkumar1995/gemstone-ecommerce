"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Gem, Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import { adminApi } from "@/lib/admin-api";

export function AdminLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const d = Object.fromEntries(
      new FormData(e.currentTarget).entries()
    ) as Record<string, string>;

    setLoading(true);
    const res = await adminApi.login(d.email, d.password);
    setLoading(false);

    if (res.ok) {
      const from = params.get("from");
      router.replace(from && from.startsWith("/admin") ? from : "/admin");
      router.refresh();
    } else {
      setError(res.message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-sm"
    >
      {/* mobile-only brand (brand panel is hidden on small screens) */}
      <div className="mb-8 flex items-center gap-2.5 lg:hidden">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#e6b43a] to-[#9169ff] text-white">
          <Gem size={20} />
        </span>
        <span className="text-lg font-semibold" style={{ color: "var(--a-fg)" }}>
          Nakshatra
        </span>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--a-fg)" }}>
        Welcome back
      </h1>
      <p className="mt-1.5 text-sm" style={{ color: "var(--a-muted)" }}>
        Sign in to your admin console to continue.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label="Email" icon={Mail} delay={0.1}>
          <input
            name="email"
            type="email"
            required
            placeholder="admin@nakshatra.com"
            defaultValue="admin@nakshatra.com"
            className={inputClass}
          />
        </Field>

        <Field label="Password" icon={Lock} delay={0.18}>
          <input
            name="password"
            type={showPass ? "text" : "password"}
            required
            placeholder="••••••••"
            defaultValue="admin123"
            className={`${inputClass} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            aria-label="Toggle password"
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--a-muted)" }}
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </Field>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.24 }}
          className="flex items-center justify-between text-sm"
        >
          <label className="flex items-center gap-2" style={{ color: "var(--a-muted)" }}>
            <input type="checkbox" className="accent-[#c9942a]" defaultChecked />
            Remember me
          </label>
          <button type="button" className="font-medium text-[#c9942a] hover:underline">
            Forgot?
          </button>
        </motion.div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-rose-500/10 px-3 py-2.5 text-sm text-rose-600"
          >
            {error}
          </motion.p>
        )}

        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className="group flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#e6b43a] to-[#c9942a] py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_rgba(201,148,42,0.7)] transition-all hover:brightness-105 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign In"}
          {!loading && (
            <ArrowRight
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          )}
        </motion.button>
      </form>

      <div
        className="mt-6 flex items-center justify-center gap-1.5 text-xs"
        style={{ color: "var(--a-faint)" }}
      >
        <ShieldCheck size={13} /> Encrypted & secure admin access
      </div>

      <div
        className="mt-6 rounded-lg border border-dashed px-4 py-3 text-center text-xs"
        style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}
      >
        Demo credentials pre-filled · just click{" "}
        <span className="font-semibold" style={{ color: "var(--a-fg)" }}>
          Sign In
        </span>
      </div>
    </motion.div>
  );
}

const inputClass =
  "w-full rounded-lg border bg-transparent py-2.5 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-[var(--a-faint)] focus:border-[var(--a-gold)] focus:ring-2 focus:ring-[var(--a-gold-soft)]";

function Field({
  label,
  icon: Icon,
  delay,
  children,
}: {
  label: string;
  icon: React.ElementType;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.label
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="block"
    >
      <span className="mb-1.5 block text-sm font-medium" style={{ color: "var(--a-fg)" }}>
        {label}
      </span>
      <div className="relative">
        <Icon
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
          style={{ color: "var(--a-muted)" }}
        />
        {children}
      </div>
    </motion.label>
  );
}
