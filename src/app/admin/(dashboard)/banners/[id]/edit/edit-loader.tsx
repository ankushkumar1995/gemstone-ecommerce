"use client";

import { useEffect, useState } from "react";
import type { Banner } from "@/modules/banners";
import { adminApi } from "@/lib/admin-api";
import { TableSkeleton, EmptyState } from "@/app/admin/_components";
import { BannerFormPage } from "../../banner-form-page";

export function EditLoader({ id }: { id: string }) {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    (async () => {
      const res = await adminApi.banners.get(id);
      if (res.ok) {
        setBanner(res.data);
        setState("ok");
      } else setState("missing");
    })();
  }, [id]);

  if (state === "loading") return <TableSkeleton rows={6} cols={2} />;
  if (state === "missing" || !banner)
    return <EmptyState title="Banner not found" message="This banner may have been deleted." />;

  return <BannerFormPage editing={banner} />;
}
