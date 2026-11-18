"use client";

/**
 * Admin view of one signature: the full signed copy (exact text, full IP,
 * user agent, integrity check) and the option to void it with a reason.
 * Voiding never deletes the record; the partner must sign again.
 */

import { useState } from "react";
import { Ban, Mail } from "lucide-react";
import { astroAdminApi } from "@/lib/admin-astro-api";
import type { AgreementAcceptance, SignedCopy } from "@/modules/agreements/agreement.types";
import { AdminButton, AdminTextarea, Card, EmptyState, Field, Modal, StatsSkeleton, useAdminToast, useOnMount } from "../../../../../_components";
import { AgreementDocument } from "@/components/agreements/agreement-document";

export function AdminSignatureView({ id }: { id: string }) {
  const { toast } = useAdminToast();
  const [data, setData] = useState<SignedCopy<AgreementAcceptance> | null>(null);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  const load = async () => {
    const r = await astroAdminApi.agreements.copy(id);
    if (r.ok) setData(r.data); else { setMissing(true); toast(r.message, "error"); }
  };
  useOnMount(load);

  if (missing) return <EmptyState title="Signature not found" message="Check the link and try again." />;
  if (!data) return <StatsSkeleton count={2} />;
  const a = data.acceptance;

  const emailCopy = async () => {
    setSending(true);
    const r = await astroAdminApi.agreements.emailCopy(a.id);
    setSending(false);
    if (r.ok) toast(`Signed copy emailed to ${r.data.sentTo}`, "success"); else toast(r.message, "error");
  };

  const runVoid = async () => {
    setBusy(true);
    const r = await astroAdminApi.agreements.voidSignature(a.id, reason.trim());
    setBusy(false);
    if (!r.ok) { toast(r.message, "error"); return; }
    toast("Signature voided. The partner was asked to sign again.", "success");
    setOpen(false);
    setReason("");
    await load();
  };

  return (
    <div className="space-y-4">
      {!a.voided && (
        <Card className="flex flex-wrap items-center gap-3 p-4 print:hidden">
          <p className="flex-1 text-sm" style={{ color: "var(--a-muted)" }}>
            Signed by <b style={{ color: "var(--a-fg)" }}>{a.signer.displayName}</b> · certificate <span className="font-mono">{a.certificateNo}</span>. If this was signed by mistake or by someone else, void it. The record is kept.
          </p>
          <AdminButton variant="outline" onClick={emailCopy} disabled={sending}><Mail size={15} />{sending ? "Sending…" : "Email copy to partner"}</AdminButton>
          <AdminButton variant="danger" onClick={() => setOpen(true)}><Ban size={15} />Void signature</AdminButton>
        </Card>
      )}
      <p className="text-xs print:hidden" style={{ color: "var(--a-faint)" }}>
        {a.pdf ? `Archived PDF stored ${new Date(a.pdf.storedAt).toLocaleString("en-IN")} · SHA-256 ${a.pdf.sha256.slice(0, 16)}…` : "No archived PDF (file storage was not available at signing). The PDF is generated from the signed record."}
        {" "}&ldquo;Email copy&rdquo; works for any account status, including suspended.
      </p>
      <div className="-mx-4 sm:-mx-6">
        <AgreementDocument
          agreement={data.agreement}
          acceptance={a}
          verified={data.verified}
          backHref={`/admin/astrologers/agreements/${a.agreementId}`}
          backLabel={`Agreement v${a.version}`}
          pdfHref={`/api/v1/admin/agreement-acceptances/${a.id}/pdf`}
        />
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Void this signature?" subtitle="The partner gets an email and must sign again. This is logged." size="sm">
        <div className="space-y-4">
          <Field label="Reason (sent to the partner)" required hint="At least 10 characters"><AdminTextarea rows={3} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} placeholder="e.g. Signed from a shared device by someone else" /></Field>
          <AdminButton className="w-full" variant="danger" disabled={reason.trim().length < 10 || busy} onClick={runVoid}>{busy ? "Voiding…" : "Void signature"}</AdminButton>
        </div>
      </Modal>
    </div>
  );
}
