"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/types";
import type { ApiResponse } from "@/core/http";
import { TableSkeleton, EmptyState } from "@/app/admin/_components";
import { ProductFormPage } from "@/app/admin/(dashboard)/products/product-form-page";

/**
 * Client loader for the edit page — fetches the product by id, then renders
 * the shared form in edit mode.
 */
export function EditLoader({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/v1/products/${id}`);
        const body = (await res.json()) as ApiResponse<Product>;
        if (body.success) {
          setProduct(body.data);
          setStatus("ok");
        } else {
          setStatus("missing");
        }
      } catch {
        setStatus("missing");
      }
    })();
  }, [id]);

  if (status === "loading") {
    return (
      <div className="space-y-4">
        <TableSkeleton rows={6} cols={2} />
      </div>
    );
  }
  if (status === "missing" || !product) {
    return (
      <EmptyState
        title="Product not found"
        message="This product may have been deleted."
      />
    );
  }
  return <ProductFormPage editing={product} />;
}
