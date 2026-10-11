"use client";

import { Construction } from "lucide-react";
import { Card, PageHeader } from "../_components/ui";

/** Reusable "coming soon" panel for admin sections not built yet. */
export function ComingSoon({
  title,
  subtitle,
  note,
}: {
  title: string;
  subtitle: string;
  note: string;
}) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <Card>
        <div className="flex flex-col items-center py-14 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-lg"
            style={{ background: "var(--a-surface-2)", color: "var(--a-gold)" }}
          >
            <Construction size={26} />
          </span>
          <p className="mt-4 text-lg font-semibold" style={{ color: "var(--a-fg)" }}>
            Coming soon
          </p>
          <p className="mt-1 max-w-sm text-sm" style={{ color: "var(--a-muted)" }}>
            {note}
          </p>
        </div>
      </Card>
    </div>
  );
}
