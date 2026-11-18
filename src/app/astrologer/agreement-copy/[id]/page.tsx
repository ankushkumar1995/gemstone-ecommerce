"use client";

/** Partner's signed copy, loaded from the server (exact signed text + certificate + integrity check). */

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { partnerApi } from "@/lib/astrologer-api";
import type { SignedCopy } from "@/modules/agreements/agreement.types";
import { useOnMount } from "@/app/admin/_components";
import { AgreementDocument } from "@/components/agreements/agreement-document";

export default function AgreementCopyPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SignedCopy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useOnMount(() => {
    void partnerApi.agreement.copy(id).then((r) => (r.ok ? setData(r.data) : setError(r.message)));
  });

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-[#e9ebf1] px-4 text-center text-sm text-zinc-600">
        {error}. <Link className="underline" href="/astrologer/agreement">Back to partner agreement</Link>
      </div>
    );
  }
  if (!data) {
    return <div className="flex min-h-screen items-center justify-center bg-[#e9ebf1] text-zinc-500" role="status" aria-label="Loading"><Loader2 className="animate-spin" /></div>;
  }
  return (
    <AgreementDocument
      agreement={data.agreement}
      acceptance={data.acceptance}
      verified={data.verified}
      backHref="/astrologer/agreement"
      backLabel="Partner agreement"
      pdfHref={`/api/v1/astrologer/agreement/acceptances/${encodeURIComponent(data.acceptance.id)}/pdf`}
    />
  );
}
