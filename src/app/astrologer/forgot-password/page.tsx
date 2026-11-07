"use client";

import Link from "next/link";
import { useState } from "react";
import { partnerApi } from "@/lib/astrologer-api";
import { AdminButton, AdminInput, Field } from "@/app/admin/_components";
import { AuthFrame, FormError } from "../_components/auth-frame";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await partnerApi.auth.forgot(email);
    setLoading(false);
    if (!res.ok) { setError(res.message); return; }
    setSent(true);
    setDevToken(res.data.devToken);
  };

  return (
    <AuthFrame title="Reset your password" subtitle="We will email you a link to set a new password." footer={<Link href="/astrologer/login" className="font-semibold" style={{ color: "var(--a-gold)" }}>Back to sign in</Link>}>
      {sent ? (
        <div className="space-y-3 text-sm" style={{ color: "var(--a-fg)" }}>
          <p>If an account exists for <b>{email}</b>, a reset link is on its way. It is valid for 1 hour.</p>
          {devToken && (
            <p className="rounded-lg bg-amber-500/10 p-3 text-amber-800">
              Development only: email is not configured, so use this link:{" "}
              <Link className="break-all font-semibold underline" href={`/astrologer/reset-password?token=${devToken}`}>open reset page</Link>
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email"><AdminInput type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <FormError message={error} />
          <AdminButton type="submit" className="w-full" disabled={loading || !email}>{loading ? "Sending…" : "Send reset link"}</AdminButton>
        </form>
      )}
    </AuthFrame>
  );
}
