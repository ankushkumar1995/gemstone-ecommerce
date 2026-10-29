"use client";

import { useEffect, useState } from "react";
import type { Popup } from "@/modules/popups";
import { adminApi } from "@/lib/admin-api";
import { TableSkeleton, EmptyState } from "@/app/admin/_components";
import { PopupFormPage } from "../../popup-form-page";

export function EditLoader({ id }: { id: string }) {
  const [popup, setPopup] = useState<Popup | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    (async () => {
      const res = await adminApi.popups.get(id);
      if (res.ok) {
        setPopup(res.data);
        setState("ok");
      } else setState("missing");
    })();
  }, [id]);

  if (state === "loading") return <TableSkeleton rows={6} cols={2} />;
  if (state === "missing" || !popup)
    return <EmptyState title="Popup not found" message="This popup may have been deleted." />;

  return <PopupFormPage editing={popup} />;
}
