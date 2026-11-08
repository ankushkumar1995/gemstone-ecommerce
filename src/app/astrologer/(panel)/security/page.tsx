"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { partnerApi } from "@/lib/astrologer-api";
import { AdminButton, AdminInput, Card, ConfirmDialog, Field, PageHeader, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { FormError } from "../../_components/auth-frame";
import { DevicesCard, TwoStepCard } from "../../_components/security-extras";

export default function SecurityPage() {
  return <Suspense><SecurityInner /></Suspense>;
}

function SecurityInner() {
  const { me, reload } = usePartner();
  const { toast } = useAdminToast();
  const router = useRouter();
  const first = useSearchParams().get("first") === "1" || Boolean(me?.mustChangePassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [askAll, setAskAll] = useState(false);
  const [askDeactivate, setAskDeactivate] = useState(false);

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) { setError("New passwords do not match"); return; }
    setBusy(true);
    const res = await partnerApi.auth.changePassword(current, next);
    setBusy(false);
    if (!res.ok) { setError(res.message); return; }
    setCurrent(""); setNext(""); setConfirm("");
    toast("Password updated. Other devices were signed out.", "success");
    await reload();
    if (first) router.replace("/astrologer");
  };

  const logoutAll = async () => {
    await partnerApi.auth.logout(true);
    router.replace("/astrologer/login");
  };

  const deactivate = async () => {
    const res = await partnerApi.setStatus("deactivated", "Deactivated by the astrologer");
    if (res.ok) { toast("Profile deactivated. You can reactivate it from the dashboard.", "info"); await reload(); router.replace("/astrologer"); }
    else toast(res.message, "error");
  };

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Security" subtitle={first ? "Set your own password to continue." : "Keep your partner account safe."} />
      {first && <Card className="p-4 text-sm" style={{ color: "var(--a-gold)" }}>You signed in with a temporary password. Choose a new one before using the panel.</Card>}

      <Card className="p-5">
        <form onSubmit={change} className="space-y-4">
          <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Change password</p>
          <Field label={first ? "Temporary password" : "Current password"}><AdminInput type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
          <Field label="New password" hint="8+ characters, a letter and a number"><AdminInput type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
          <Field label="Confirm new password"><AdminInput type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          <FormError message={error} />
          <AdminButton type="submit" disabled={busy || !current || !next}>{busy ? "Saving…" : "Update password"}</AdminButton>
        </form>
      </Card>

      {!first && (
        <>
          <TwoStepCard />
          <DevicesCard onSignOutAll={() => setAskAll(true)} />
          <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Sign out everywhere</p>
              <p className="text-sm" style={{ color: "var(--a-muted)" }}>Use this if you lost a phone or signed in on a shared computer.</p>
            </div>
            <AdminButton variant="outline" onClick={() => setAskAll(true)}>Sign out all devices</AdminButton>
          </Card>
          {me?.status === "approved" && (
            <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Take a break</p>
                <p className="text-sm" style={{ color: "var(--a-muted)" }}>Deactivate hides your profile from customers. Your earnings and history stay safe.</p>
              </div>
              <AdminButton variant="danger" onClick={() => setAskDeactivate(true)}>Deactivate profile</AdminButton>
            </Card>
          )}
        </>
      )}
      <ConfirmDialog open={askAll} onClose={() => setAskAll(false)} onConfirm={logoutAll} title="Sign out all devices?" message="You will need to sign in again on every device, including this one." confirmLabel="Sign out all" danger />
      <ConfirmDialog open={askDeactivate} onClose={() => setAskDeactivate(false)} onConfirm={deactivate} title="Deactivate your profile?" message="Customers will not see you until you reactivate and our team reviews your profile again." confirmLabel="Deactivate" danger />
    </div>
  );
}
