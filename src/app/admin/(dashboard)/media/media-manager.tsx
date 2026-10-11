"use client";

import { ImageIcon, HardDrive, CalendarDays } from "lucide-react";
import { useMedia } from "@/lib/media-store";
import { PageHeader, Card, StatCard } from "../../_components";
import { MediaLibrary } from "../../_components/media/media-library";

export function MediaManager() {
  const { items } = useMedia();
  const totalSize = items.reduce((s, m) => s + (m.size ?? 0), 0);

  return (
    <div>
      <PageHeader title="Media Library" subtitle="Upload and manage all your store images in one place." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={ImageIcon} value={items.length} label="Total Media" tone="royal" />
        <StatCard
          icon={HardDrive}
          value={totalSize ? `${(totalSize / 1024 / 1024).toFixed(1)} MB` : "—"}
          label="Uploaded Size"
          tone="gold"
        />
        <StatCard icon={CalendarDays} value="Mock" label="Storage (demo)" tone="green" />
      </div>

      <Card>
        <MediaLibrary />
      </Card>
    </div>
  );
}
