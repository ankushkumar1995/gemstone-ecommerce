"use client";

import { useEffect, useState } from "react";
import type { Article } from "@/types";
import { adminApi } from "@/lib/admin-api";
import { TableSkeleton, EmptyState } from "@/app/admin/_components";
import { ArticleFormPage } from "../../article-form-page";

export function EditLoader({ id }: { id: string }) {
  const [article, setArticle] = useState<Article | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    (async () => {
      const res = await adminApi.articles.get(id);
      if (res.ok) {
        setArticle(res.data);
        setState("ok");
      } else setState("missing");
    })();
  }, [id]);

  if (state === "loading") return <TableSkeleton rows={6} cols={2} />;
  if (state === "missing" || !article)
    return <EmptyState title="Article not found" message="This article may have been deleted." />;

  return <ArticleFormPage editing={article} />;
}
