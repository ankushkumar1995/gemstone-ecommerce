"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { partnerApi } from "@/lib/astrologer-api";
import { AdminButton, AdminInput, Field } from "@/app/admin/_components";
import { AuthFrame, FormError } from "../_components/auth-frame";

export function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    setError(null);
    const res = await partnerApi.auth.reset(token, pw);
    setLoading(false);
    if (!res.ok) { setError(res.message); return; }
    setDone(true);
  };

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return <AuthFrame title="Link not valid" subtitle="This reset link is incomplete or has expired."><Link href="/astrologer/forgot-password" className="font-semibold" style={{ color: "var(--a-gold)" }}>Request a new link</Link></AuthFrame>;
  }
  return (
    <AuthFrame title="Set a new password" subtitle="All other devices will be signed out.">
      {done ? (
        <p className="text-sm" style={{ color: "var(--a-fg)" }}>Password updated. <Link href="/astrologer/login" className="font-semibold" style={{ color: "var(--a-gold)" }}>Sign in</Link></p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password" hint="8+ characters, a letter and a number"><AdminInput type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Field label="Confirm password"><AdminInput type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          <FormError message={error} />
          <AdminButton type="submit" className="w-full" disabled={loading || !pw}>{loading ? "Saving…" : "Update password"}</AdminButton>
        </form>
      )}
    </AuthFrame>
  );
}
