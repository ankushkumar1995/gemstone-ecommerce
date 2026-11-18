"use client";

/** Report of one live (from Past lives). */

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminButton, PageHeader } from "@/app/admin/_components";
import { LiveReportCard } from "../../../_components/live-report";

export default function LiveReportPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-6">
      <PageHeader title="Live report" subtitle="How this live did: viewers, followers, gifts and the chats it brought."
        action={<Link href="/astrologer/live"><AdminButton variant="outline"><ArrowLeft size={15} /> Back to Go live</AdminButton></Link>} />
      {id ? <LiveReportCard liveId={id} /> : null}
    </div>
  );
}
