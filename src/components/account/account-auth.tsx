"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  Package,
  Heart,
  Sparkles,
} from "lucide-react";
import { useCommerce } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

type Tab = "login" | "signup";

const perks = [
  { icon: Package, text: "Track orders & view history" },
  { icon: Heart, text: "Save your favourite gemstones" },
  { icon: Sparkles, text: "Personalised astrology picks" },
  { icon: ShieldCheck, text: "Faster, secure checkout" },
];

export function AccountAuth() {
  const [tab, setTab] = useState<Tab>("login");
  const [showPass, setShowPass] = useState(false);
  const { login } = useCommerce();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(
      new FormData(e.currentTarget).entries()
    ) as Record<string, string>;
    login({
      name: data.name || data.email?.split("@")[0] || "Guest",
      email: data.email,
    });
    toast(tab === "login" ? "Welcome back!" : "Account created!", "success");
  };

  // Demo Google sign-in. In production this is replaced by a real OAuth flow
  // (NextAuth / Auth.js with GOOGLE_CLIENT_ID). For now it logs in a mock user.
  const handleGoogle = () => {
    login({ name: "Google User", email: "user@gmail.com" });
    toast("Signed in with Google", "success");
  };

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumb items={[{ label: "Account" }]} className="mb-8" />
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-foreground/10 shadow-[0_30px_80px_-40px_rgba(36,26,59,0.45)] lg:grid-cols-2">
        {/* ---- Brand side ---- */}
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-royal-500 to-royal-700 p-10 text-white lg:flex">
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-gold-400/25 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl font-semibold leading-tight">
              Welcome to <span className="text-gold-200">Nakshatra</span>
            </h2>
            <p className="mt-3 max-w-xs text-sm text-white/80">
              Your gateway to certified, astrologically-aligned gemstones.
            </p>
          </div>
          <ul className="relative mt-10 space-y-4">
            {perks.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-sm text-white/90">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <p.icon size={17} />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>

        {/* ---- Form side ---- */}
        <div className="bg-nebula p-8 sm:p-10">
          <div className="flex gap-1 rounded-full border border-foreground/10 bg-void p-1">
            {(["login", "signup"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "relative isolate flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors duration-300",
                  tab === t ? "text-white" : "text-muted hover:text-foreground"
                )}
              >
                {tab === t && (
                  <motion.span
                    layoutId="auth-tab"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-gold-400 to-gold-500 shadow-[0_8px_20px_-8px_rgba(201,148,42,0.6)]"
                  />
                )}
                <span className="relative z-10">
                  {t === "login" ? "Sign In" : "Create Account"}
                </span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleSubmit}
              className="mt-7 space-y-4"
            >
              {/* Google sign-in */}
              <button
                type="button"
                onClick={handleGoogle}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-foreground/15 bg-void py-3 text-sm font-semibold text-foreground transition-colors hover:border-gold-400/60 hover:bg-gold-400/5"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              {/* divider */}
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-foreground/10" />
                <span className="text-xs text-muted">or {tab === "login" ? "sign in" : "sign up"} with email</span>
                <span className="h-px flex-1 bg-foreground/10" />
              </div>

              {tab === "signup" && (
                <IconField icon={User} label="Full Name" name="name">
                  <input
                    name="name"
                    type="text"
                    required
                    placeholder="Your name"
                    className={inputClass}
                  />
                </IconField>
              )}

              <IconField icon={Mail} label="Email" name="email">
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </IconField>

              <IconField icon={Lock} label="Password" name="password">
                <input
                  name="password"
                  type={showPass ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  className={cn(inputClass, "pr-10")}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </IconField>

              {tab === "login" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-sm font-medium text-gold-600 hover:text-gold-500"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <Button variant="gold" size="lg" type="submit" className="w-full">
                {tab === "login" ? "Sign In" : "Create Account"}
              </Button>

              <p className="text-center text-xs text-muted">
                By continuing you agree to our{" "}
                <Link href="/policies" className="text-gold-600 hover:underline">
                  Terms & Privacy Policy
                </Link>
                .
              </p>
            </motion.form>
          </AnimatePresence>
        </div>
      </div>
    </Container>
  );
}

const inputClass =
  "w-full rounded-xl border border-foreground/15 bg-void py-3 pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20";

/** Official multi-colour Google "G" mark. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.3-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5c-7.6 0-14.2 4.3-17.7 10.2z" />
      <path fill="#4CAF50" d="M24 43.5c5.4 0 10.3-2 14-5.3l-6.5-5.5c-2 1.5-4.6 2.3-7.5 2.3-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.8 39.2 16.3 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5c-.5.4 6.8-5 6.8-15.1 0-1.2-.1-2.3-.3-3.5z" />
    </svg>
  );
}

function IconField({
  icon: Icon,
  label,
  name,
  children,
}: {
  icon: React.ElementType;
  label: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={name} className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </span>
      <div className="relative">
        <Icon
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        {children}
      </div>
    </label>
  );
}
