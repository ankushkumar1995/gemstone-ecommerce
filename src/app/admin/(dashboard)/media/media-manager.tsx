"use client";

import { ImageIcon, HardDrive, Cloud, Loader2 } from "lucide-react";
import { useMedia } from "@/lib/media-store";
import { PageHeader, Card, StatCard } from "../../_components";
import { MediaLibrary } from "../../_components/media/media-library";

export function MediaManager() {
  const { items, syncing } = useMedia();
  const totalSize = items.reduce((s, m) => s + (m.size ?? 0), 0);

  return (
    <div>
      <PageHeader title="Media Library" subtitle="Upload and manage all your store images in one place." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={ImageIcon} value={items.length} label="Total Media" tone="royal" />
        <StatCard
          icon={HardDrive}
          value={totalSize ? `${(totalSize / 1024 / 1024).toFixed(1)} MB` : "—"}
          label="Total Size"
          tone="gold"
        />
        <StatCard
          icon={syncing ? Loader2 : Cloud}
          value={syncing ? "Syncing…" : "Amazon S3"}
          label="Storage (live)"
          tone="green"
        />
      </div>

      <Card>
        <MediaLibrary />
      </Card>
    </div>
  );
}
