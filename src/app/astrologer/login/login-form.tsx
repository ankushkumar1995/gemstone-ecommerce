"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { partnerApi } from "@/lib/astrologer-api";
import { AdminButton, AdminInput, Field } from "@/app/admin/_components";
import { AuthFrame, FormError } from "../_components/auth-frame";

/** Only allow same-area redirects after login (no open redirect). */
const safeFrom = (v: string | null) => (v && v.startsWith("/astrologer") && !v.startsWith("//") ? v : "/astrologer");

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await partnerApi.auth.login(email, password);
    setLoading(false);
    if (!res.ok) { setError(res.message); return; }
    router.replace(res.data.astrologer.mustChangePassword ? "/astrologer/security?first=1" : safeFrom(params.get("from")));
  };

  return (
    <AuthFrame
      title="Partner sign in"
      subtitle="Manage your consultations, earnings and profile."
      footer={<>New to Astrounkle? <Link href="/astrologer/apply" className="font-semibold" style={{ color: "var(--a-gold)" }}>Apply as an astrologer</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email">
          <AdminInput type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password">
          <div className="relative">
            <AdminInput type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-11" />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5" style={{ color: "var(--a-muted)" }}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        <FormError message={error} />
        <AdminButton type="submit" disabled={loading || !email || !password} className="w-full">{loading ? "Signing in…" : "Sign in"}</AdminButton>
        <p className="text-center text-sm"><Link href="/astrologer/forgot-password" style={{ color: "var(--a-muted)" }} className="hover:underline">Forgot password?</Link></p>
      </form>
    </AuthFrame>
  );
}
