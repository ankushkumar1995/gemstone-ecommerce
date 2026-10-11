"use client";

import { useEffect, useState } from "react";
import type { CmsPage } from "@/modules/pages";
import { adminApi } from "@/lib/admin-api";
import { TableSkeleton, EmptyState } from "@/app/admin/_components";
import { PageForm } from "../../page-form";

export function EditLoader({ id }: { id: string }) {
  const [page, setPage] = useState<CmsPage | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    (async () => {
      const res = await adminApi.pages.get(id);
      if (res.ok) {
        setPage(res.data);
        setState("ok");
      } else setState("missing");
    })();
  }, [id]);

  if (state === "loading") return <TableSkeleton rows={6} cols={2} />;
  if (state === "missing" || !page)
    return <EmptyState title="Page not found" message="This page may have been deleted." />;

  return <PageForm editing={page} />;
}
