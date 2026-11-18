"use client";

/** Astrologer detail → Agreement: online gate + every signature with evidence. */

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Lock } from "lucide-react";
import { astroAdminApi } from "@/lib/admin-astro-api";
import type { AgreementAcceptance, AgreementGateInfo } from "@/modules/agreements/agreement.types";
import { Badge, Card, EmptyState, StatsSkeleton, useAdminToast, useOnMount } from "../../../_components";
import { fmtIst } from "../agreements/agreement-meta";

export function AstrologerAgreementTab({ id }: { id: string }) {
  const { toast } = useAdminToast();
  const [data, setData] = useState<{ acceptances: AgreementAcceptance[]; gate: AgreementGateInfo; signupConsent: { version: string; at: string; ip: string; device: string } | null } | null>(null);

  useOnMount(async () => {
    const r = await astroAdminApi.agreements.forAstrologer(id);
    if (r.ok) setData(r.data); else toast(r.message, "error");
  });

  if (!data) return <StatsSkeleton count={1} />;
  const g = data.gate;

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-start gap-3 p-5">
        {g.gate === "none" ? <CheckCircle2 className="text-emerald-600" size={20} /> : g.gate === "pending" ? <Clock size={20} style={{ color: "var(--a-gold)" }} /> : <Lock className="text-rose-600" size={20} />}
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold" style={{ color: "var(--a-fg)" }}>
            {!g.agreementId ? "No agreement is published" : g.signed ? `Signed the current version v${g.version}` : g.gate === "blocked" ? `Cannot go online: v${g.version} not signed` : `v${g.version} not signed yet`}
          </p>
          {g.agreementId && !g.signed && (
            <p style={{ color: "var(--a-muted)" }}>
              Deadline {fmtIst(g.deadline)}{g.extendedUntil ? " (personal extension)" : ""}. {g.reason ?? ""}
            </p>
          )}
        </div>
        {g.agreementId && <Link href={`/admin/astrologers/agreements/${g.agreementId}`} className="text-sm font-semibold" style={{ color: "var(--a-gold)" }}>Open version</Link>}
      </Card>

      {data.signupConsent && (
        <Card className="p-4 text-sm">
          <p className="font-semibold" style={{ color: "var(--a-fg)" }}>At signup: read partner agreement v{data.signupConsent.version}</p>
          <p className="text-xs" style={{ color: "var(--a-muted)" }}>
            {fmtIst(data.signupConsent.at)} · {data.signupConsent.device || "unknown device"} · IP {data.signupConsent.ip || "unknown"}. A &ldquo;read and understood&rdquo; record, not a signature.
          </p>
        </Card>
      )}

      {data.acceptances.length === 0 ? (
        <EmptyState title="No signatures yet" message="Signatures appear here once this partner signs a version." />
      ) : (
        <Card className="divide-y px-5" style={{ borderColor: "var(--a-border)" }}>
          {data.acceptances.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Version {a.version}</p>
                  {a.voided ? <Badge tone="rose">Void</Badge> : a.agreementId === g.agreementId ? <Badge tone="green">Current</Badge> : <Badge tone="muted">Older</Badge>}
                  {!a.otp.delivered && <Badge tone="gold">Test-mode OTP</Badge>}
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--a-muted)" }}>
                  {fmtIst(a.signedAt)} · as “{a.typedName}” · OTP {a.otp.channel.toUpperCase()} to {a.otp.destinationMasked} · {a.device} · IP {a.ip || "unknown"}
                </p>
                {a.voided && <p className="mt-1 text-xs text-rose-700">Voided {fmtIst(a.voidedAt)}{a.voidedBy ? ` by ${a.voidedBy}` : ""}: {a.voidReason}</p>}
              </div>
              <Link href={`/admin/astrologers/agreements/signatures/${a.id}`} className="font-mono text-xs font-semibold" style={{ color: "var(--a-gold)" }}>{a.certificateNo}</Link>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
