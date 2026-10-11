"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Pencil, Eye, Trash2 } from "lucide-react";
import type { Product } from "@/types";
import { formatPrice } from "@/lib/utils";
import { Badge, StatusPill } from "../../_components";

/**
 * Premium product card used in the DataTable's grid view. Hover reveals a
 * quick-action overlay; image zooms; card lifts.
 */
export function ProductGridCard({
  product,
  onEdit,
  onView,
  onDelete,
}: {
  product: Product;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className="group overflow-hidden rounded-xl border"
      style={{
        background: "var(--a-surface)",
        borderColor: "var(--a-border)",
        boxShadow: "0 1px 2px rgba(20,20,40,0.04)",
      }}
    >
      {/* image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width:768px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {product.badge && (
          <span className="absolute left-2 top-2">
            <Badge tone="gold">{product.badge}</Badge>
          </span>
        )}
        <span className="absolute right-2 top-2">
          {product.inStock ? (
            <StatusPill tone="green">In stock</StatusPill>
          ) : (
            <StatusPill tone="rose">Out</StatusPill>
          )}
        </span>

        {/* hover action overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 backdrop-blur-[1px] transition-opacity duration-300 group-hover:opacity-100">
          <OverlayBtn label="View" onClick={onView}>
            <Eye size={16} />
          </OverlayBtn>
          <OverlayBtn label="Edit" onClick={onEdit}>
            <Pencil size={16} />
          </OverlayBtn>
          <OverlayBtn label="Delete" danger onClick={onDelete}>
            <Trash2 size={16} />
          </OverlayBtn>
        </div>
      </div>

      {/* body */}
      <div className="p-4">
        <p className="line-clamp-1 font-semibold" style={{ color: "var(--a-fg)" }}>
          {product.name}
        </p>
        <p className="mt-0.5 line-clamp-1 text-xs" style={{ color: "var(--a-faint)" }}>
          {product.attributes.stone}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-bold" style={{ color: "var(--a-fg)" }}>
            {formatPrice(product.price)}
          </span>
          <Badge tone="royal">{product.category}</Badge>
        </div>
      </div>
    </motion.div>
  );
}

function OverlayBtn({
  children,
  label,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg backdrop-blur-sm"
      style={{ background: danger ? "rgba(225,29,72,0.9)" : "rgba(255,255,255,0.2)" }}
    >
      {children}
    </motion.button>
  );
}
